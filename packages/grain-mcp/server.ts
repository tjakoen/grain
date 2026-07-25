// grain-mcp/server.ts — wires jsonrpc.ts + tools.ts into an MCP server, as a pure dispatcher.
// `handleMessage(state, msg) → response|null` is the whole server: no socket, no stdin/stdout — cli.ts
// is the only thing that touches a stream, feeding it lines and writing back whatever comes out. That
// split is what makes a full protocol handshake unit-testable in-process (server.test.ts) AND is what
// the end-to-end smoke test (cli.test.ts) then re-confirms works over an ACTUAL spawned process.
//
// MCP method surface this server answers (see https://modelcontextprotocol.io/specification):
//   initialize                    → capabilities + serverInfo (the ONE request every client sends first)
//   notifications/initialized     → no response (it's a notification — nothing to reply with)
//   ping                          → {} (liveness check some clients poll)
//   tools/list                    → the four ToolDeclarations, unchanged from tools.ts
//   tools/call                    → runs one tool, wraps its ToolResult as MCP `content`
//   anything else                 → -32601 Method not found
import { ACTIONS } from "@tjakoen/grain/ai/contract.ts";
import {
  parseLine, buildResult, methodNotFound, invalidParams, internalError,
  type JsonRpcResponse, type JsonRpcRequest, type JsonRpcNotification,
} from "./jsonrpc.ts";
import { TOOLS, type GrainExport } from "./tools.ts";

export const SERVER_NAME = "grain-mcp";
export const SERVER_VERSION = "0.1.0";

// Protocol versions this server has been checked against, newest first — `initialize` echoes the
// client's requested version back when it's one of these (so a client pinned to an older revision of
// the spec sees itself acknowledged), else answers with the latest we know (never a version we've
// never heard of — that would be a promise this server can't back up).
const KNOWN_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const LATEST_PROTOCOL_VERSION = KNOWN_PROTOCOL_VERSIONS[0]!;

export interface ServerState {
  export: GrainExport;
  initialized: boolean;   // set true once `initialize` has answered — informational only (this
                           // server has no per-connection state machine to enforce against)
}

export function createServerState(exp: GrainExport): ServerState {
  return { export: exp, initialized: false };
}

// ── initialize: the capabilities this server actually has ──────────────────────────────────────────
function handleInitialize(state: ServerState, req: JsonRpcRequest): JsonRpcResponse {
  const params = (req.params ?? {}) as { protocolVersion?: unknown };
  const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : undefined;
  const protocolVersion = requested && KNOWN_PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL_VERSION;
  state.initialized = true;
  return buildResult(req.id, {
    protocolVersion,
    capabilities: { tools: {} },   // read-only tools only — no resources/prompts/sampling capability
    serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
  });
}

// ── tools/list: the declarations, verbatim ──────────────────────────────────────────────────────────
function handleToolsList(req: JsonRpcRequest): JsonRpcResponse {
  return buildResult(req.id, { tools: TOOLS.map((t) => t.declaration) });
}

// ── tools/call: run one tool, wrap its verdict as MCP `content` ────────────────────────────────────
// A BAD CALL (unknown tool name, malformed `arguments`) is still a JSON-RPC SUCCESS carrying
// `isError: true` — MCP's own rule (a tool's own rejection is not a transport failure). A JSON-RPC
// -32602 is reserved for the CALL ITSELF being malformed (missing "name"), same split tools.ts's
// ToolResult already draws between a shape error and a domain rejection.
function handleToolsCall(state: ServerState, req: JsonRpcRequest): JsonRpcResponse {
  const params = (req.params ?? {}) as { name?: unknown; arguments?: unknown };
  if (typeof params.name !== "string" || !params.name) {
    return invalidParams(req.id, `"name" must be a non-empty string`);
  }
  const entry = TOOLS.find((t) => t.declaration.name === params.name);
  if (!entry) {
    return buildResult(req.id, {
      isError: true,
      content: [{ type: "text", text: `unknown tool ${JSON.stringify(params.name)} — known tools: ${TOOLS.map((t) => t.declaration.name).join(", ")}` }],
    });
  }
  try {
    const result = entry.handler(state.export, params.arguments ?? {});
    return buildResult(req.id, {
      isError: result.isError,
      content: [{ type: "text", text: JSON.stringify(result.payload, null, 2) }],
    });
  } catch (e) {
    // A tool threw (e.g. harvest.ts's loud "unsupported selector" guard) — surface it as an internal
    // JSON-RPC error, not a tool result: this is OUR bug, not the caller's bad arguments.
    return internalError(req.id, e instanceof Error ? e.message : String(e));
  }
}

// ── ping: the MCP liveness check ────────────────────────────────────────────────────────────────────
function handlePing(req: JsonRpcRequest): JsonRpcResponse {
  return buildResult(req.id, {});
}

/** Dispatch one PARSED JSON-RPC request to its MCP handler. Returns `null` for a notification (no
 *  reply is ever sent for one) or for a method this server has literally nothing to say about at the
 *  notification level; every REQUEST (has an id) always gets exactly one response line back, success
 *  or JSON-RPC error. Pure modulo `state.initialized` (a single boolean flip, no I/O). */
export function handleMessage(
  state: ServerState,
  msg: JsonRpcRequest | JsonRpcNotification,
): JsonRpcResponse | null {
  const isNotification = !("id" in msg);

  switch (msg.method) {
    case "initialize":
      return isNotification ? null : handleInitialize(state, msg);
    case "notifications/initialized":
      return null;   // a notification by name too — no response either way
    case "ping":
      return isNotification ? null : handlePing(msg);
    case "tools/list":
      return isNotification ? null : handleToolsList(msg);
    case "tools/call":
      return isNotification ? null : handleToolsCall(state, msg);
    default:
      // A notification for a method we don't recognize is silently dropped (nothing to reply with,
      // and MCP clients may send notifications this server has no opinion on); a REQUEST for an
      // unknown method is the one case that gets the standard JSON-RPC -32601.
      return isNotification ? null : methodNotFound(msg.id, msg.method);
  }
}

/** Parse one raw stdio line and dispatch it — the single entry point cli.ts's read loop calls per
 *  line. Folds `parseLine`'s own failure into the same `JsonRpcResponse | null` shape `handleMessage`
 *  returns, so the caller (cli.ts) has exactly one thing to do with the result: if non-null, write
 *  `toLine(response)` to stdout; if null, write nothing. */
export function handleLine(state: ServerState, line: string): JsonRpcResponse | null {
  const parsed = parseLine(line);
  if (!parsed.ok) {
    // A parse/invalid-request failure with a recoverable id gets a proper error response; one with no
    // recoverable id (couldn't even tell if it was meant to be a notification) still gets a response
    // on the wire — id:null is legal JSON-RPC for "we don't know who asked" (§5, spec) — because
    // unlike a genuine notification, this was never confirmed to BE one.
    return { jsonrpc: "2.0", id: parsed.id, error: parsed.error };
  }
  return handleMessage(state, parsed.message);
}

// re-exported so a consumer (cli.ts, tests) can print/inspect the registry without importing
// tools.ts directly for this one fact.
export const ACTION_COUNT = Object.keys(ACTIONS).length;

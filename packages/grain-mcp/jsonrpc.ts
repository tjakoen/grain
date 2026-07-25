// grain-mcp/jsonrpc.ts — pure JSON-RPC 2.0 wire core (the substrate MCP's stdio transport rides on).
//
// MCP over stdio is JSON-RPC 2.0, one message per line: newline-delimited JSON, UTF-8, no literal
// newline inside a message (https://modelcontextprotocol.io/specification — "stdio transport"). A
// server reads lines from stdin, writes response lines to stdout, and NEVER writes anything else to
// stdout — a stray console.log would corrupt the stream a client is line-parsing, so all diagnostics
// go to stderr (cli.ts's job, not this module's). This file only shapes messages; it never touches a
// stream — that keeps the wire format unit-testable with plain strings/objects, same discipline as
// grain/ai/model.ts's parse+validate split (parse untrusted input, build trusted output, no I/O
// between).

// ---- the wire shapes (JSON-RPC 2.0, https://www.jsonrpc.org/specification) -----------------------
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: unknown;
}

/** A notification is a request with no `id` — the sender doesn't want a reply (MCP's
 *  `notifications/initialized` is the one this server receives). */
export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcSuccessResponse {
  jsonrpc: "2.0";
  id: string | number;
  result: unknown;
}

export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: string | number | null;   // null when the request's own id couldn't be recovered (parse error)
  error: JsonRpcError;
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;
export type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification;

// ---- the standard error codes this server ever raises (JSON-RPC 2.0 §5.1 reserved range) ----------
export const ERROR_PARSE = -32700;           // the line wasn't valid JSON
export const ERROR_INVALID_REQUEST = -32600; // valid JSON, not a well-formed JSON-RPC envelope
export const ERROR_METHOD_NOT_FOUND = -32601;
export const ERROR_INVALID_PARAMS = -32602;
export const ERROR_INTERNAL = -32603;

// ---- parsing one line off the wire ------------------------------------------------------------
export type ParsedLine =
  | { ok: true; kind: "request"; message: JsonRpcRequest }
  | { ok: true; kind: "notification"; message: JsonRpcNotification }
  | { ok: false; id: string | number | null; error: JsonRpcError };

/** Parse ONE line of the stdio stream into a request, a notification, or a reportable error. Never
 *  throws — a malformed line becomes a `{ok:false}` carrying the JSON-RPC error the caller can hand
 *  straight to `buildErrorResponse` (or drop, if it can't even recover an id — a notification-shaped
 *  parse failure has nothing to reply to). Blank lines (stdio keep-alives some clients send) parse as
 *  a `false` with -32700, same as any other unparsable line — the caller decides whether to answer. */
export function parseLine(line: string): ParsedLine {
  let json: unknown;
  try {
    json = JSON.parse(line);
  } catch {
    return { ok: false, id: null, error: { code: ERROR_PARSE, message: "Parse error: invalid JSON" } };
  }
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return { ok: false, id: null, error: { code: ERROR_INVALID_REQUEST, message: "Invalid Request: not a JSON object" } };
  }
  const obj = json as Record<string, unknown>;
  const id = "id" in obj ? obj.id : undefined;
  const idForError = (typeof id === "string" || typeof id === "number") ? id : null;

  if (obj.jsonrpc !== "2.0") {
    return { ok: false, id: idForError, error: { code: ERROR_INVALID_REQUEST, message: 'Invalid Request: "jsonrpc" must be "2.0"' } };
  }
  if (typeof obj.method !== "string" || !obj.method) {
    return { ok: false, id: idForError, error: { code: ERROR_INVALID_REQUEST, message: 'Invalid Request: "method" must be a non-empty string' } };
  }

  // no "id" at all → a notification (id: null is still an id per spec, so only ABSENCE counts).
  if (!("id" in obj)) {
    return { ok: true, kind: "notification", message: { jsonrpc: "2.0", method: obj.method, params: obj.params } };
  }
  if (typeof id !== "string" && typeof id !== "number") {
    return { ok: false, id: null, error: { code: ERROR_INVALID_REQUEST, message: 'Invalid Request: "id" must be a string or number' } };
  }
  return { ok: true, kind: "request", message: { jsonrpc: "2.0", id, method: obj.method, params: obj.params } };
}

// ---- building responses --------------------------------------------------------------------------
export function buildResult(id: string | number, result: unknown): JsonRpcSuccessResponse {
  return { jsonrpc: "2.0", id, result };
}

export function buildErrorResponse(id: string | number | null, error: JsonRpcError): JsonRpcErrorResponse {
  return { jsonrpc: "2.0", id, error };
}

export const methodNotFound = (id: string | number | null, method: string): JsonRpcErrorResponse =>
  buildErrorResponse(id, { code: ERROR_METHOD_NOT_FOUND, message: `Method not found: ${method}` });

export const invalidParams = (id: string | number | null, detail: string): JsonRpcErrorResponse =>
  buildErrorResponse(id, { code: ERROR_INVALID_PARAMS, message: `Invalid params: ${detail}` });

export const internalError = (id: string | number | null, detail: string): JsonRpcErrorResponse =>
  buildErrorResponse(id, { code: ERROR_INTERNAL, message: `Internal error: ${detail}` });

/** Serialize a response to exactly one wire line (no trailing newline — the writer's job to
 *  terminate it): the stdio contract requires the JSON itself never contain a literal newline, which
 *  `JSON.stringify` already guarantees (it escapes \n inside strings). */
export function toLine(msg: JsonRpcResponse): string {
  return JSON.stringify(msg);
}

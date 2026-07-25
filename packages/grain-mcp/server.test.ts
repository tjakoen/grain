// grain-mcp/server.test.ts — a full in-process MCP handshake over the pure dispatcher: no process,
// no stdio, just handleMessage/handleLine called directly (the end-to-end-over-a-real-process version
// of the same handshake lives in cli.test.ts).
import { test, expect } from "bun:test";
import { createServerState, handleMessage, handleLine, SERVER_NAME, SERVER_VERSION } from "./server.ts";
import { loadExport } from "./tools.ts";
import { parseLine, ERROR_METHOD_NOT_FOUND, ERROR_PARSE } from "./jsonrpc.ts";

const FILES: Record<string, string> = {
  "index.html": `<html><head><title>Welcome</title></head><body data-screen="welcome"><div data-surface="chat-log"></div></body></html>`,
  "mail/index.html": `<html><head><title>Mail</title></head><body data-screen="mail">
      <a data-kind="item" data-accepts="item.archive" data-surface="item:mail-1">hi</a>
    </body></html>`,
};

const req = (id: number, method: string, params?: unknown) => ({ jsonrpc: "2.0" as const, id, method, params });
const note = (method: string, params?: unknown) => ({ jsonrpc: "2.0" as const, method, params });

test("initialize: echoes a KNOWN protocol version and reports serverInfo + tools capability", () => {
  const state = createServerState(loadExport(FILES));
  const res = handleMessage(state, req(1, "initialize", { protocolVersion: "2024-11-05" }));
  expect(res).toEqual({
    jsonrpc: "2.0", id: 1,
    result: {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    },
  });
});

test("initialize: an UNKNOWN protocol version falls back to our latest, not an error", () => {
  const state = createServerState(loadExport(FILES));
  const res = handleMessage(state, req(1, "initialize", { protocolVersion: "1999-01-01" }));
  expect(res && "result" in res && (res.result as { protocolVersion: string }).protocolVersion).toBe("2025-06-18");
});

test("notifications/initialized: no response at all (it's a notification)", () => {
  const state = createServerState(loadExport(FILES));
  expect(handleMessage(state, note("notifications/initialized"))).toBeNull();
});

test("ping: an empty result", () => {
  const state = createServerState(loadExport(FILES));
  expect(handleMessage(state, req(2, "ping"))).toEqual({ jsonrpc: "2.0", id: 2, result: {} });
});

test("tools/list: the four declarations", () => {
  const state = createServerState(loadExport(FILES));
  const res = handleMessage(state, req(3, "tools/list"));
  const tools = (res as { result: { tools: { name: string }[] } }).result.tools;
  expect(tools.map((t) => t.name)).toEqual(["grain_pages", "grain_manifest", "grain_actions", "grain_validate_move"]);
});

test("tools/call: grain_pages returns MCP content with the JSON payload as text, isError false", () => {
  const state = createServerState(loadExport(FILES));
  const res = handleMessage(state, req(4, "tools/call", { name: "grain_pages", arguments: {} }));
  const result = (res as { result: { isError: boolean; content: { type: string; text: string }[] } }).result;
  expect(result.isError).toBe(false);
  expect(result.content[0]!.type).toBe("text");
  expect(JSON.parse(result.content[0]!.text)).toEqual({ pages: [{ route: "/", title: "Welcome" }, { route: "/mail", title: "Mail" }] });
});

test("tools/call: each of the four tools round-trips through the dispatcher", () => {
  const state = createServerState(loadExport(FILES));
  const calls: [string, unknown][] = [
    ["grain_pages", {}],
    ["grain_manifest", { route: "/mail" }],
    ["grain_actions", {}],
    ["grain_validate_move", { route: "/mail", move: { action: "item.archive", target: "item:mail-1" } }],
  ];
  for (const [name, args] of calls) {
    const res = handleMessage(state, req(5, "tools/call", { name, arguments: args }));
    const result = (res as { result: { isError: boolean; content: { text: string }[] } }).result;
    expect(result.isError).toBe(false);
    expect(() => JSON.parse(result.content[0]!.text)).not.toThrow();
  }
});

test("tools/call: a tool-level rejection (bad route) is isError:true, NOT a JSON-RPC error", () => {
  const state = createServerState(loadExport(FILES));
  const res = handleMessage(state, req(6, "tools/call", { name: "grain_manifest", arguments: { route: "/nope" } }));
  expect(res && "result" in res).toBe(true);
  const result = (res as { result: { isError: boolean; content: { text: string }[] } }).result;
  expect(result.isError).toBe(true);
  expect(JSON.parse(result.content[0]!.text).reason).toContain("unknown route");
});

test("tools/call: an unknown tool name is also isError:true, not -32601", () => {
  const state = createServerState(loadExport(FILES));
  const res = handleMessage(state, req(7, "tools/call", { name: "grain_teleport", arguments: {} }));
  const result = (res as { result: { isError: boolean; content: { text: string }[] } }).result;
  expect(result.isError).toBe(true);
  expect(result.content[0]!.text).toContain("unknown tool");
});

test("tools/call: missing 'name' is a genuine JSON-RPC invalid-params error (the CALL itself is malformed)", () => {
  const state = createServerState(loadExport(FILES));
  const res = handleMessage(state, req(8, "tools/call", { arguments: {} }));
  expect(res).toMatchObject({ jsonrpc: "2.0", id: 8, error: { code: -32602 } });
});

test("an unknown method on a request → -32601 Method not found", () => {
  const state = createServerState(loadExport(FILES));
  const res = handleMessage(state, req(9, "resources/list"));
  expect(res).toMatchObject({ jsonrpc: "2.0", id: 9, error: { code: ERROR_METHOD_NOT_FOUND } });
});

test("an unknown method as a NOTIFICATION (no id) gets silently dropped, not an error reply", () => {
  const state = createServerState(loadExport(FILES));
  expect(handleMessage(state, note("some/future/notification"))).toBeNull();
});

test("handleLine: a full line round-trips through parseLine + handleMessage", () => {
  const state = createServerState(loadExport(FILES));
  const res = handleLine(state, JSON.stringify(req(10, "ping")));
  expect(res).toEqual({ jsonrpc: "2.0", id: 10, result: {} });
});

test("handleLine: an unparsable line still yields a reportable -32700 response", () => {
  const state = createServerState(loadExport(FILES));
  const res = handleLine(state, "{not json at all");
  expect(res).toMatchObject({ jsonrpc: "2.0", id: null, error: { code: ERROR_PARSE } });
});

test("full handshake, in order: initialize -> initialized -> tools/list -> tools/call", () => {
  const state = createServerState(loadExport(FILES));
  const init = handleMessage(state, req(1, "initialize", { protocolVersion: "2025-06-18" }));
  expect(init).toMatchObject({ result: { serverInfo: { name: SERVER_NAME } } });
  expect(handleMessage(state, note("notifications/initialized"))).toBeNull();
  const list = handleMessage(state, req(2, "tools/list"));
  expect((list as { result: { tools: unknown[] } }).result.tools).toHaveLength(4);
  const call = handleMessage(state, req(3, "tools/call", { name: "grain_actions", arguments: {} }));
  expect((call as { result: { isError: boolean } }).result.isError).toBe(false);
  // sanity: parseLine agrees with what a real client would have sent on the wire for each step
  expect(parseLine(JSON.stringify(req(1, "initialize"))).ok).toBe(true);
});

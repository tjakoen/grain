// grain-mcp/jsonrpc.test.ts — the pure JSON-RPC 2.0 wire core: parse a line, build a response.
import { test, expect } from "bun:test";
import {
  parseLine, buildResult, buildErrorResponse, methodNotFound, invalidParams, internalError, toLine,
  ERROR_PARSE, ERROR_INVALID_REQUEST, ERROR_METHOD_NOT_FOUND, ERROR_INVALID_PARAMS, ERROR_INTERNAL,
} from "./jsonrpc.ts";

test("parseLine: a well-formed request", () => {
  const p = parseLine('{"jsonrpc":"2.0","id":1,"method":"ping","params":{}}');
  expect(p).toEqual({ ok: true, kind: "request", message: { jsonrpc: "2.0", id: 1, method: "ping", params: {} } });
});

test("parseLine: a string id is legal", () => {
  const p = parseLine('{"jsonrpc":"2.0","id":"abc","method":"tools/list"}');
  expect(p.ok && p.kind === "request" && p.message.id).toBe("abc");
});

test("parseLine: no 'id' field at all → a notification, not a request", () => {
  const p = parseLine('{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}');
  expect(p).toEqual({ ok: true, kind: "notification", message: { jsonrpc: "2.0", method: "notifications/initialized", params: {} } });
});

test("parseLine: invalid JSON → -32700 parse error, id unrecoverable", () => {
  const p = parseLine("{not json");
  expect(p).toEqual({ ok: false, id: null, error: { code: ERROR_PARSE, message: expect.stringContaining("Parse error") } });
});

test("parseLine: blank line → parse error, same path as any unparsable line", () => {
  const p = parseLine("");
  expect(p.ok).toBe(false);
  if (!p.ok) expect(p.error.code).toBe(ERROR_PARSE);
});

test("parseLine: a JSON array (not an object) → invalid request", () => {
  const p = parseLine("[1,2,3]");
  expect(p.ok).toBe(false);
  if (!p.ok) expect(p.error.code).toBe(ERROR_INVALID_REQUEST);
});

test("parseLine: wrong jsonrpc version → invalid request, id echoed back if present", () => {
  const p = parseLine('{"jsonrpc":"1.0","id":5,"method":"ping"}');
  expect(p).toEqual({ ok: false, id: 5, error: { code: ERROR_INVALID_REQUEST, message: expect.any(String) } });
});

test("parseLine: missing method → invalid request", () => {
  const p = parseLine('{"jsonrpc":"2.0","id":1}');
  expect(p.ok).toBe(false);
  if (!p.ok) expect(p.error.code).toBe(ERROR_INVALID_REQUEST);
});

test("parseLine: a non-string/number id → invalid request", () => {
  const p = parseLine('{"jsonrpc":"2.0","id":{},"method":"ping"}');
  expect(p.ok).toBe(false);
  if (!p.ok) expect(p.error.code).toBe(ERROR_INVALID_REQUEST);
});

test("buildResult: wraps a result under the request's id", () => {
  expect(buildResult(7, { ok: true })).toEqual({ jsonrpc: "2.0", id: 7, result: { ok: true } });
});

test("buildErrorResponse + the named helpers carry the right codes", () => {
  expect(methodNotFound(1, "bogus")).toEqual({ jsonrpc: "2.0", id: 1, error: { code: ERROR_METHOD_NOT_FOUND, message: expect.stringContaining("bogus") } });
  expect(invalidParams(1, "route required")).toEqual({ jsonrpc: "2.0", id: 1, error: { code: ERROR_INVALID_PARAMS, message: expect.stringContaining("route required") } });
  expect(internalError(1, "boom")).toEqual({ jsonrpc: "2.0", id: 1, error: { code: ERROR_INTERNAL, message: expect.stringContaining("boom") } });
});

test("toLine: serializes to one line with no embedded literal newline", () => {
  const line = toLine(buildResult(1, { text: "a\nb" }));
  expect(line.split("\n")).toHaveLength(1);
  expect(JSON.parse(line)).toEqual({ jsonrpc: "2.0", id: 1, result: { text: "a\nb" } });
});

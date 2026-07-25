// grain-mcp/cli.test.ts — end-to-end SMOKE: spawn `bun cli.ts <fixture-dir>` as a real child process,
// speak the MCP handshake over its actual stdin/stdout, and confirm the wire behaves — the one test in
// this package that exercises the FULL stack (fs walk, harvest, tools, server, jsonrpc) as an external
// MCP client would actually see it, not just in-process (server.test.ts already covers the dispatcher
// logic directly; this is "does the process itself hold up").
import { test, expect } from "bun:test";
import { join } from "node:path";

const CLI = join(import.meta.dir, "cli.ts");
const FIXTURE_DIR = join(import.meta.dir, "fixtures", "export");

interface Rpc { jsonrpc: "2.0"; id?: number; method: string; params?: unknown }
const line = (msg: Rpc) => JSON.stringify(msg) + "\n";

/** Spawn the CLI against the fixture export, write a script of request lines to its stdin, then close
 *  stdin and collect every stdout line as a parsed JSON-RPC message. stderr is captured too (for the
 *  startup banner assertion) but never mixed into the stdout stream the wire contract governs. */
async function runCli(lines: string[]): Promise<{ responses: unknown[]; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", CLI, FIXTURE_DIR], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  const writer = proc.stdin;
  for (const l of lines) writer.write(l);
  await writer.end();

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  const responses = stdout.split("\n").filter((l) => l.trim().length > 0).map((l) => JSON.parse(l));
  return { responses, stderr, exitCode };
}

test("smoke: initialize -> initialized -> tools/list -> tools/call over a real spawned process", async () => {
  const script = [
    line({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }),
    line({ jsonrpc: "2.0", method: "notifications/initialized" }),   // a notification: no reply expected
    line({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    line({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "grain_pages", arguments: {} } }),
    line({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "grain_manifest", arguments: { route: "/about" } } }),
  ];
  const { responses, stderr, exitCode } = await runCli(script);

  // exactly 4 response lines: the notification got none, the four requests got exactly one each
  expect(responses).toHaveLength(4);
  expect(responses.map((r) => (r as { id: number }).id)).toEqual([1, 2, 3, 4]);

  const init = responses[0] as { result: { serverInfo: { name: string }; protocolVersion: string } };
  expect(init.result.serverInfo.name).toBe("grain-mcp");
  expect(init.result.protocolVersion).toBe("2025-06-18");

  const list = responses[1] as { result: { tools: { name: string }[] } };
  expect(list.result.tools.map((t) => t.name)).toEqual(["grain_pages", "grain_manifest", "grain_actions", "grain_validate_move"]);

  const pages = responses[2] as { result: { content: { text: string }[] } };
  const pagesPayload = JSON.parse(pages.result.content[0]!.text) as { pages: { route: string }[] };
  expect(pagesPayload.pages.map((p) => p.route).sort()).toEqual(["/", "/about"]);

  const manifest = responses[3] as { result: { isError: boolean; content: { text: string }[] } };
  expect(manifest.result.isError).toBe(false);
  const manifestPayload = JSON.parse(manifest.result.content[0]!.text) as { manifest: { targets: { id: string }[] } };
  expect(manifestPayload.manifest.targets.map((t) => t.id)).toEqual(["notepad", "notepad-body"]);

  // stdout carried ONLY valid JSON-RPC lines (already proven by JSON.parse above succeeding for all
  // 4); the startup banner went to stderr instead, never polluting the wire.
  expect(stderr).toContain("grain-mcp");
  expect(stderr).toContain("serving 2 page(s)");

  expect(exitCode).toBe(0);   // stdin closed → clean exit, no hang
});

test("smoke: the placeholder item in the fixture's own comment never shows up as a real target", async () => {
  const script = [
    line({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "grain_manifest", arguments: { route: "/" } } }),
  ];
  const { responses } = await runCli(script);
  const result = responses[0] as { result: { content: { text: string }[] } };
  const payload = JSON.parse(result.result.content[0]!.text) as { manifest: { targets: { id: string }[] } };
  const ids = payload.manifest.targets.map((t) => t.id);
  expect(ids).toContain("item:about-1");   // the real, resolved surface survives
  expect(ids.some((id) => id.includes("<"))).toBe(false);
});

test("smoke: an unparsable line gets a -32700 response, doesn't crash the process", async () => {
  const script = ["{not valid json at all\n", line({ jsonrpc: "2.0", id: 1, method: "ping" })];
  const { responses, exitCode } = await runCli(script);
  expect(responses).toHaveLength(2);
  expect((responses[0] as { error: { code: number } }).error.code).toBe(-32700);
  expect(responses[1]).toEqual({ jsonrpc: "2.0", id: 1, result: {} });
  expect(exitCode).toBe(0);
});

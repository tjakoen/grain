// grain-mcp/tools.test.ts — the pure tool layer over a small in-memory export.
import { test, expect } from "bun:test";
import { deriveRoute, loadExport, grainPages, grainManifest, grainActions, grainValidateMove, TOOLS } from "./tools.ts";

// A tiny two-page export: a root with a chat-log target, and a "/mail" with one item + a notepad —
// enough surface area to exercise every tool without needing the real site.
const FILES: Record<string, string> = {
  "index.html": `<html><head><title>Welcome</title></head>
    <body data-screen="welcome">
      <div data-surface="chat-log"></div>
    </body></html>`,
  "mail/index.html": `<html><head><title>Mail</title></head>
    <body data-screen="mail">
      <a data-kind="item" data-accepts="item.archive" data-surface="item:mail-1">hi</a>
      <div data-surface="notepad-body" data-kind="notepad" data-read>call the bank</div>
    </body></html>`,
};

test("deriveRoute: index.html shapes and root", () => {
  expect(deriveRoute("index.html")).toBe("/");
  expect(deriveRoute("mail/index.html")).toBe("/mail");
  expect(deriveRoute("batch/docs/getting-started/index.html")).toBe("/batch/docs/getting-started");
});

test("deriveRoute: a bare *.html at any depth drops its extension", () => {
  expect(deriveRoute("about.html")).toBe("/about");
  expect(deriveRoute("foo/bar.html")).toBe("/foo/bar");
});

test("deriveRoute: rejects a non-html path loudly", () => {
  expect(() => deriveRoute("notes.json")).toThrow(/not an \.html file/);
});

test("loadExport: routes + titles, sorted", () => {
  const exp = loadExport(FILES);
  expect(exp.pages.map((p) => p.route)).toEqual(["/", "/mail"]);
  expect(exp.pages.find((p) => p.route === "/mail")!.title).toBe("Mail");
});

test("grain_pages: route + title per page, no input needed", () => {
  const exp = loadExport(FILES);
  const result = grainPages(exp, {});
  expect(result.isError).toBe(false);
  expect(result.payload).toEqual({ pages: [{ route: "/", title: "Welcome" }, { route: "/mail", title: "Mail" }] });
});

test("grain_manifest: a known route returns the harvested manifest + text rendering", () => {
  const exp = loadExport(FILES);
  const result = grainManifest(exp, { route: "/mail" });
  expect(result.isError).toBe(false);
  const payload = result.payload as { manifest: { targets: { id: string }[] }; text: string };
  expect(payload.manifest.targets.map((t) => t.id)).toEqual(["item:mail-1", "notepad-body"]);
  expect(payload.text).toContain("screen: mail");
  expect(payload.text).toContain("item:mail-1");
});

test("grain_manifest: an unknown route is an informative rejection naming the known routes", () => {
  const exp = loadExport(FILES);
  const result = grainManifest(exp, { route: "/nope" });
  expect(result.isError).toBe(true);
  expect((result.payload as { reason: string }).reason).toBe('unknown route "/nope" — known routes: /, /mail');
});

test("grain_manifest: a missing/non-string route is a shape rejection, not a crash", () => {
  const exp = loadExport(FILES);
  const result = grainManifest(exp, {});
  expect(result.isError).toBe(true);
  expect((result.payload as { reason: string }).reason).toMatch(/route.*non-empty string/);
});

test("grain_actions: the whole registry, MCP-annotation-shaped", () => {
  const result = grainActions(loadExport(FILES), {});
  expect(result.isError).toBe(false);
  const payload = result.payload as { actions: { name: string; annotations: Record<string, boolean> }[] };
  const archive = payload.actions.find((a) => a.name === "item.archive")!;
  expect(archive.annotations).toEqual({ readOnlyHint: false, destructiveHint: false, idempotentHint: true });
  const stop = payload.actions.find((a) => a.name === "desk.stop")!;
  expect(stop.annotations.readOnlyHint).toBe(true);
});

test("grain_validate_move: a legal move on a real target validates", () => {
  const exp = loadExport(FILES);
  const result = grainValidateMove(exp, { route: "/mail", move: { action: "item.archive", target: "item:mail-1" } });
  expect(result.isError).toBe(false);
  expect(result.payload).toEqual({ route: "/mail", move: { action: "item.archive", target: "item:mail-1", payload: {}, reply: undefined } });
});

test("grain_validate_move: an illegal verb-target pairing rejects and echoes valid targets", () => {
  const exp = loadExport(FILES);
  // chat.send only applies to chat-log surfaces — item:mail-1 doesn't accept it
  const result = grainValidateMove(exp, { route: "/mail", move: { action: "chat.send", target: "item:mail-1", payload: { text: "hi" } } });
  expect(result.isError).toBe(true);
  const payload = result.payload as { reason: string; validTargets: string[] };
  expect(payload.reason).toMatch(/does not accept chat\.send/);
  expect(payload.validTargets).toEqual([]);   // no chat-log target exists on /mail
});

test("grain_validate_move: an unknown route is rejected before the move is even inspected", () => {
  const exp = loadExport(FILES);
  const result = grainValidateMove(exp, { route: "/nope", move: { action: "item.archive", target: "x" } });
  expect(result.isError).toBe(true);
  expect((result.payload as { reason: string }).reason).toContain("unknown route");
});

test("grain_validate_move: a target that accepts a DIFFERENT verb echoes chat-log as valid for chat.send", () => {
  const exp = loadExport(FILES);
  const result = grainValidateMove(exp, { route: "/", move: { action: "item.archive", target: "chat-log" } });
  expect(result.isError).toBe(true);
  const payload = result.payload as { validTargets: string[] };
  // item.archive is a known verb but nothing on "/" accepts it (only chat-log exists there)
  expect(payload.validTargets).toEqual([]);
});

test("TOOLS registry: four tools, each declared read-only with a strict object schema", () => {
  expect(TOOLS.map((t) => t.declaration.name)).toEqual(["grain_pages", "grain_manifest", "grain_actions", "grain_validate_move"]);
  for (const t of TOOLS) {
    expect(t.declaration.annotations).toEqual({ readOnlyHint: true });
    expect(t.declaration.inputSchema.type).toBe("object");
    expect(t.declaration.inputSchema.additionalProperties).toBe(false);
    expect(t.declaration.description.length).toBeGreaterThan(0);
  }
});

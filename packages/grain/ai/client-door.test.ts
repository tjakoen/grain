// grain/ai/client-door.test.ts — UNIT: the browser-composed door (§19.3). Same layer, loopback
// channel: ops must reach applyOp directly, the /grain demo must run service-free, and provenance
// must be the AI's — the client transport changes the wire, never the contract.
import { test, expect, describe } from "bun:test";
import { createClientDoor } from "./client-door.ts";
import type { Intent, RenderOp } from "./contract.ts";

const intent = (over: Partial<Intent> = {}): Intent => ({
  source: "user", session: "s1", screen: "grain", surface: "screen",
  action: "demo.run", payload: {}, ...over,
});

describe("createClientDoor", () => {
  test("demo.run on the grain screen loops ops straight into applyOp — no service, no wire", async () => {
    const ops: RenderOp[] = [];
    const door = createClientDoor((op) => ops.push(op), { thinkMs: 0 });
    const decision = await door.handleIntent(intent());
    expect(decision.ok).toBe(true);
    expect(ops.length).toBeGreaterThan(0);
    // every AI-authored op keeps AI provenance (grade doctrine: AI text stays grain)
    expect(ops.some((o) => o.provenance === "ai")).toBe(true);
    // the run releases: the last spotlight op must switch OFF (lesson 7 — always release)
    const spots = ops.filter((o) => o.op === "spotlight");
    expect(spots.length).toBeGreaterThan(0);
    expect(spots[spots.length - 1]?.active).toBe(false);
  });

  test("validation still guards the door: unknown action is rejected with a system flash", async () => {
    const ops: RenderOp[] = [];
    const door = createClientDoor((op) => ops.push(op), { thinkMs: 0 });
    const decision = await door.handleIntent(intent({ action: "not.a.verb" as Intent["action"] }));
    expect(decision.ok).toBe(false);
    expect(ops.every((o) => o.provenance !== "ai")).toBe(true);
  });

  test("observe(doc) re-harvests the live-DOM manifest — the 'read the result' half of the loop", () => {
    const door = createClientDoor(() => {}, { thinkMs: 0 });
    // a structural DomDoc fake (the same shape manifest-dom takes) — no browser needed
    const el = (attrs: Record<string, string>) => ({ getAttribute: (n: string) => attrs[n] ?? null, textContent: null });
    const doc = {
      body: el({ "data-screen": "grain" }),
      querySelectorAll: () => [el({ "data-surface": "chat-log" })],
    };
    const text = door.observe(doc);
    expect(text).toContain("screen: grain");
    expect(text).toContain("actions: (");                 // the move set is listed
    expect(text).toContain("- chat-log [chat-log] -> chat.send");   // and the live target
  });
});

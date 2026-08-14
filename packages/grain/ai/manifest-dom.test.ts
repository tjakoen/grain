// grain/ai/manifest-dom.test.ts — UNIT: the client-side DOM→manifest projection.
// The DOM walk is exercised with plain fakes (the module takes a structural DomRoot, not
// lib.dom), so kind derivation, accepts intersection/inversion, and push-only classification
// are all testable without a browser. Full DOM behavior is covered by the terminal e2e.
import { test, expect } from "bun:test";
import { deriveKind, deriveAccepts, targetLabel, harvestTargets, harvestReadable, collapseReadable, domManifest, manifestForReasoner, READABLE_CAP, type DomEl } from "./manifest-dom.ts";
import { actionsForKind } from "./contract.ts";

// `text` seeds textContent (the readable state); attrs seed getAttribute. Both default to absent.
const el = (attrs: Record<string, string>, text: string | null = null): DomEl =>
  ({ getAttribute: (n) => attrs[n] ?? null, textContent: text });

test("deriveKind: explicit data-kind wins; a registered kind is not push-only", () => {
  expect(deriveKind("item:ITM-1", "item")).toEqual({ kind: "item", pushOnly: false });
});

test("deriveKind: derives kind from the address prefix when data-kind is absent", () => {
  expect(deriveKind("item:ITM-9", null)).toEqual({ kind: "item", pushOnly: false });
  expect(deriveKind("chat-log", null)).toEqual({ kind: "chat-log", pushOnly: false });
});

test("deriveKind: a display feed no verb targets is push-only", () => {
  expect(deriveKind("console", null)).toEqual({ kind: "console", pushOnly: true });
  expect(deriveKind("plan", null)).toEqual({ kind: "plan", pushOnly: true });
});

test("deriveKind: an unknown explicit data-kind is push-only (not a registry kind)", () => {
  expect(deriveKind("weird", "made-up")).toEqual({ kind: "made-up", pushOnly: true });
});

test("deriveAccepts: explicit data-accepts is intersected with the real registry", () => {
  expect(deriveAccepts("item", "item.archive")).toEqual(["item.archive"]);
  // a stray/misspelled verb is dropped, not trusted
  expect(deriveAccepts("item", "item.archive bogus.verb")).toEqual(["item.archive"]);
});

test("deriveAccepts: with no explicit list, a registered kind inverts the registry", () => {
  expect(deriveAccepts("chat-log", null)).toEqual(actionsForKind("chat-log"));
  expect(deriveAccepts("chat-log", null)).toContain("chat.send");
});

test("deriveAccepts: a push-only kind accepts nothing", () => {
  expect(deriveAccepts("console", null)).toEqual([]);
});

test("targetLabel: verbs joined, else push-only", () => {
  expect(targetLabel({ id: "item:1", kind: "item", accepts: ["item.archive"] })).toBe("item · item.archive");
  expect(targetLabel({ id: "console", kind: "console", accepts: [], pushOnly: true })).toBe("console · push-only");
});

test("harvestTargets: walks [data-surface], skips empties, derives each", () => {
  const root = {
    querySelectorAll: () => [
      el({ "data-surface": "item:ITM-1", "data-kind": "item", "data-accepts": "item.archive" }),
      el({ "data-surface": "chat-log" }),
      el({ "data-surface": "console" }),
      el({ "data-surface": "" }),   // skipped
    ],
  };
  const targets = harvestTargets(root);
  expect(targets.map((t) => t.id)).toEqual(["item:ITM-1", "chat-log", "console"]);
  expect(targets[0]).toMatchObject({ kind: "item", accepts: ["item.archive"], pushOnly: false });
  expect(targets[1].accepts).toContain("chat.send");
  expect(targets[2]).toMatchObject({ kind: "console", accepts: [], pushOnly: true });
});

test("domManifest: same shape as the server manifest, marked a live-DOM projection", () => {
  const doc = {
    body: el({ "data-screen": "grain" }),
    querySelectorAll: () => [el({ "data-surface": "chat-log" })],
  };
  const m = domManifest(doc);
  expect(m.screen).toBe("grain");
  expect(m.actions.length).toBeGreaterThan(0);      // the full verb registry, as the server sends
  // each advertised action carries its calling contract — description + payload schema
  for (const a of m.actions) {
    expect(typeof a.description).toBe("string");
    expect(a.description.length).toBeGreaterThan(0);
    expect(typeof a.payload).toBe("object");
  }
  const chat = m.actions.find((a) => a.name === "chat.send")!;
  expect(chat.payload.text).toMatchObject({ type: "string", required: true });
  expect(m.targets[0].id).toBe("chat-log");
  // inView carries the addressable surfaces AND the readable-state array (empty: no data-read here)
  expect(m.inView).toEqual({ surfaces: ["chat-log"], readable: [] });
  expect(m.note).toMatch(/live dom/i);
});

test("collapseReadable: trims, squeezes whitespace/newlines to single spaces", () => {
  expect(collapseReadable("  buy   milk\n\n and eggs ")).toBe("buy milk and eggs");
  expect(collapseReadable(null)).toBe("");
  expect(collapseReadable("   ")).toBe("");
});

test("collapseReadable: caps overlong text with a trailing ellipsis", () => {
  const long = "x".repeat(READABLE_CAP + 50);
  const out = collapseReadable(long);
  expect(out.length).toBe(READABLE_CAP);
  expect(out.endsWith("…")).toBe(true);
});

test("harvestReadable: only surfaces that opted in with data-read, with their live text", () => {
  const root = {
    querySelectorAll: () => [
      el({ "data-surface": "reflection", "data-read": "" }, "  Noted:  buy milk "),
      el({ "data-surface": "notepad-body", "data-kind": "notepad", "data-read": "" }, "## Notes\ncall the bank"),
      el({ "data-surface": "chat-log" }, "unmarked — not harvested"),   // no data-read → skipped
      el({ "data-surface": "console", "data-read": "" }, "   "),         // marked but empty → skipped
    ],
  };
  const readable = harvestReadable(root);
  expect(readable).toEqual([
    { id: "reflection", kind: "reflection", text: "Noted: buy milk" },
    { id: "notepad-body", kind: "notepad", text: "## Notes call the bank" },
  ]);
});

test("manifestForReasoner: renders an 'in view' block for data-read surfaces", () => {
  const doc = {
    body: el({ "data-screen": "loop" }),
    querySelectorAll: () => [
      el({ "data-surface": "reflection", "data-read": "" }, "Noted: buy milk"),
    ],
  };
  const text = manifestForReasoner(doc);
  expect(text).toContain('in view: (1)\n- reflection [reflection] "Noted: buy milk"');
});

test("manifestForReasoner: deterministic, prompt-ready text — same fixed DOM in, same string out", () => {
  const doc = {
    body: el({ "data-screen": "notes" }),
    querySelectorAll: () => [
      el({ "data-surface": "item:ITM-1", "data-kind": "item", "data-accepts": "item.archive" }),
      el({ "data-surface": "chat-log" }),
      el({ "data-surface": "console" }),   // push-only — no verb targets it
    ],
  };
  const first = manifestForReasoner(doc);
  const second = manifestForReasoner(doc);
  expect(first).toBe(second);                        // deterministic

  // Structure: screen line, then the full MOVE SET (actions with payload shape), then targets.
  expect(first.startsWith("screen: notes\nactions: (")).toBe(true);
  // a no-arg verb, a required-text verb, and a noted markdown verb — the payload contract, surfaced
  expect(first).toContain("- item.archive [light] (no args) — Archive an item");
  expect(first).toContain("- chat.send [light] (text*:string) — Send a chat message");
  expect(first).toContain("- note.append [light] (text*:string (markdown)) — Append one markdown entry");
  expect(first).toContain("- navigate [light] (href*:string (root-relative path, e.g. /notes)) —");
  // behaviour hints ride along in braces so the reasoner can retry/choose safely
  expect(first).toContain("- note.replace [light] (text*:string (markdown)) — Rewrite the whole notepad from one markdown body. {destructive, idempotent}");
  expect(first).toContain("- navigate [light] (href*:string (root-relative path, e.g. /notes)) — Change screens — same-origin, root-relative href only (validated at the door). {read");
  // the targets tail is exact and comes after the actions block. `console` accepts no verb, so it
  // is NOT listed — the count says two of three so the omission is stated rather than hidden.
  expect(first.endsWith(
    "targets: (2 of 3 accept a verb)\n" +
    "- item:ITM-1 [item] -> item.archive\n" +
    "- chat-log [chat-log] -> chat.send"
  )).toBe(true);
  expect(first).not.toContain("console");
});

test("manifestForReasoner: a screen with nothing push-only is byte-identical to before the narrowing", () => {
  // The fleet guarantee. Narrowing must be a no-op wherever there was no noise to cut, which is why
  // the count keeps its bare "(n)" form when nothing was omitted.
  const doc = {
    body: el({ "data-screen": "notes" }),
    querySelectorAll: () => [
      el({ "data-surface": "item:ITM-1", "data-kind": "item", "data-accepts": "item.archive" }),
      el({ "data-surface": "chat-log" }),
    ],
  };
  expect(manifestForReasoner(doc).endsWith(
    "targets: (2)\n" +
    "- item:ITM-1 [item] -> item.archive\n" +
    "- chat-log [chat-log] -> chat.send"
  )).toBe(true);
});

test("manifestForReasoner: chat messages pile up in domManifest and never reach the prompt", () => {
  // The measured case, in miniature. On /builder 17 of 53 targets were chat-msg ids: `chat-msg` is
  // no registered SurfaceKind, so every one is push-only, and the 0.5B picked out of that list
  // rather than the blocks. The JSON manifest still carries them (validation reads that one).
  const surfaces = [
    el({ "data-surface": "block:b1", "data-kind": "block" }),
    ...Array.from({ length: 5 }, (_, i) => el({ "data-surface": `chat-msg:run-${i}` })),
  ];
  const doc = { body: el({ "data-screen": "builder" }), querySelectorAll: () => surfaces };

  expect(domManifest(doc).targets).toHaveLength(6);          // the whole page, for validation
  const text = manifestForReasoner(doc);
  expect(text).not.toContain("chat-msg");                    // none of them in the prompt
  expect(text).toContain("targets: (1 of 6 accept a verb)");
  expect(text).toContain("- block:b1 [block] -> block.remove, block.span, block.move");
});

test("manifestForReasoner: surfaces but no verbs — says so, and still reads their state", () => {
  // A page can declare surfaces that no verb reaches. "(none)" would claim it declares nothing,
  // which is a different sentence, and `in view` must survive: push-only is not unreadable.
  const doc = {
    body: el({ "data-screen": "log" }),
    querySelectorAll: () => [
      el({ "data-surface": "console", "data-read": "" }, "build finished"),
      el({ "data-surface": "plan" }),
    ],
  };
  const text = manifestForReasoner(doc);
  expect(text).toContain("targets: (0 of 2 accept a verb — nothing on this page can be acted on)");
  expect(text).toContain('in view: (1)\n- console [console] "build finished"');
});

test("manifestForReasoner: a screen-kind surface lists navigate among its accepted verbs", () => {
  const doc = {
    body: el({ "data-screen": "grain" }),
    querySelectorAll: () => [el({ "data-surface": "screen", "data-kind": "screen" })],
  };
  const text = manifestForReasoner(doc);
  expect(text).toContain("- screen [screen] ->");
  expect(text).toContain("navigate");
});

test("manifestForReasoner: no [data-surface] elements — says so plainly, doesn't crash", () => {
  const doc = { body: el({ "data-screen": "empty" }), querySelectorAll: () => [] };
  const text = manifestForReasoner(doc);
  expect(text.startsWith("screen: empty\nactions: (")).toBe(true);   // the move set is always listed
  expect(text.endsWith("targets: (none — this page declares no [data-surface] elements)")).toBe(true);
});

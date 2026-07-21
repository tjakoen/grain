// grain/ai/reasoner-kit.test.ts — the exported reasoner primitives. These are the shapes a
// consumer's real model composes with (and the stub dogfoods), so pin their contract.
import { test, expect, describe } from "bun:test";
import {
  esc, chatBubble, chatBody, narrationLine, thinkingDots, choiceGroup,
  userMessageOp, aiBubbleOp, typeToken, settleOp, replaceBodyOp, narrateOp, spotlightOp, navigateOp,
  thinkingOp, choicesOp,
  notepadEntry, notepadBody, noteAppendOp, noteReplaceOp,
  renderMarkdown,
} from "./reasoner-kit.ts";

describe("markup", () => {
  test("esc neutralizes HTML metacharacters", () => {
    expect(esc(`<b>"x"&`)).toBe("&lt;b&gt;&quot;x&quot;&amp;");
  });
  test("chatBubble carries role + grade + who", () => {
    expect(chatBubble("ai", "grain", "<i>hi</i>", "Desk"))
      .toBe('<div class="chat-message" data-role="ai" data-grade="grain"><span class="chat-message__who">Desk</span><i>hi</i></div>');
    expect(chatBubble("you", "", "x")).toContain('data-role="you"');
    expect(chatBubble("you", "", "x")).not.toContain("data-grade");
  });
  test("chatBody adds data-surface only when streaming", () => {
    expect(chatBody("hi")).toBe('<span class="chat-message__body">hi</span>');
    expect(chatBody("", "chat-msg:1")).toBe('<span class="chat-message__body" data-surface="chat-msg:1"></span>');
  });
  test("narrationLine renders an action badge + escaped desc", () => {
    expect(narrationLine("reads", "a <note>")).toContain('<span class="action-badge">reads</span>');
    expect(narrationLine("reads", "a <note>")).toContain("a &lt;note&gt;");
  });
});

describe("op-builders", () => {
  test("userMessageOp: committed human bubble on the log (escapes input)", () => {
    const op = userMessageOp("chat-log", `<script>`);
    expect(op).toMatchObject({ target: "chat-log", op: "append", provenance: "user", commit: "committed" });
    expect(op.html).toContain('data-role="you"');
    expect(op.html).toContain("&lt;script&gt;");
  });
  test("aiBubbleOp: pending grain bubble with a streamable surface", () => {
    const op = aiBubbleOp("chat-log", "chat-msg:1", "Desk");
    expect(op).toMatchObject({ provenance: "ai", commit: "pending" });
    expect(op.html).toContain('data-surface="chat-msg:1"');
    expect(op.html).toContain("Desk");
  });
  test("typeToken → pending, settleOp → committed done", () => {
    expect(typeToken("chat-msg:1", "hel")).toMatchObject({ op: "type", text: "hel", commit: "pending" });
    expect(settleOp("chat-msg:1")).toMatchObject({ op: "type", done: true, commit: "committed" });
  });
  test("replaceBodyOp keeps the surface so later ops still land", () => {
    expect(replaceBodyOp("chat-msg:1", "done", "committed").html).toContain('data-surface="chat-msg:1"');
  });
  test("narrateOp defaults to the console push-surface", () => {
    expect(narrateOp("reads", "x")).toMatchObject({ target: "console", op: "append" });
  });
  test("spotlightOp: active pends, release commits", () => {
    expect(spotlightOp("screen", { active: true, click: true })).toMatchObject({ op: "spotlight", active: true, click: true, commit: "pending" });
    expect(spotlightOp("screen", { active: false })).toMatchObject({ op: "spotlight", active: false, commit: "committed" });
  });
  test("navigateOp: a same-origin path becomes a committed navigate op", () => {
    expect(navigateOp("screen", "/notes")).toMatchObject({ target: "screen", op: "navigate", href: "/notes", commit: "committed" });
  });
  test("navigateOp: an unsafe href throws here, at compose time — not later, silently, at the dispatcher", () => {
    expect(() => navigateOp("screen", "javascript:alert(1)")).toThrow();
    expect(() => navigateOp("screen", "https://evil.example")).toThrow();
  });
  test("renderMarkdown is re-exported from the kit (same module ai/markdown.ts exports)", () => {
    expect(renderMarkdown("**hi**")).toContain("<strong>hi</strong>");
  });

  test("thinkingDots is a labelled, animatable indicator", () => {
    const d = thinkingDots();
    expect(d).toContain('class="chat-thinking"');
    expect(d).toContain('aria-label="Thinking"');
    expect((d.match(/<span><\/span>/g) ?? []).length).toBe(3);   // three dots
  });
  test("thinkingOp replaces the bubble body pending, keeping the surface for later ops", () => {
    const op = thinkingOp("chat-msg:1");
    expect(op).toMatchObject({ op: "replace", commit: "pending", target: "chat-msg:1" });
    expect(op.html).toContain("chat-thinking");
    expect(op.html).toContain('data-surface="chat-msg:1"');
  });

  test("choiceGroup: each option is a chat.send trigger carrying its own value; reuses the actionable-dialog row", () => {
    const html = choiceGroup("chat-log", [{ label: "GRAIN", value: "take me to grain" }, { label: "Notes" }]);
    expect(html).toContain('class="chat-message__actions" data-choices');   // reuses the existing dialog idiom
    expect(html).toContain('data-action="chat.send"');
    expect(html).toContain('data-target="chat-log"');
    expect(html).toContain('data-payload-text="take me to grain"');
    expect(html).toContain('data-payload-text="Notes"');                     // value defaults to label
    expect(html).toContain(">GRAIN</button>");
  });
  test("choiceGroup escapes both label and value at the single writer", () => {
    const html = choiceGroup("chat-log", [{ label: `<b>x</b>`, value: `"&<` }]);
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).toContain("&quot;&amp;&lt;");
  });
  test("choicesOp: a committed AI bubble (the ask is the AI's finished turn) carrying the prompt + choices", () => {
    const op = choicesOp("chat-log", "Where to?", [{ label: "Home", value: "go home" }]);
    expect(op).toMatchObject({ op: "choices", target: "chat-log", commit: "committed", provenance: "ai" });
    expect(op.choices).toEqual([{ label: "Home", value: "go home" }]);
    expect(op.html).toContain('data-grade="grain"');       // the ask is AI speech → grain
    expect(op.html).toContain("Where to?");
    expect(op.html).toContain('data-payload-text="go home"');
  });
});

describe("notepad markup + ops (DEMO-PLAN piece 2)", () => {
  test("notepadEntry (ai): grain grade, markdown source in data-md, rendered body", () => {
    const h = notepadEntry("**hi** there", "ai");
    expect(h).toContain('data-grade="grain"');               // AI provenance persists as grain
    expect(h).toContain('data-md="**hi** there"');           // the SOURCE, for round-trip to localStorage
    expect(h).toContain("<strong>hi</strong>");              // the rendered projection for the eye
  });
  test("notepadEntry (human commit): clean ink, no grade", () => {
    expect(notepadEntry("mine", "user")).not.toContain("data-grade");
  });
  test("notepadEntry escapes source + render so a note can never inject markup", () => {
    const h = notepadEntry("<script>x</script>", "ai");
    expect(h).not.toContain("<script>");                     // neither in data-md nor the body
  });
  test("notepadBody carries the notepad-body surface so a replace stays addressable", () => {
    expect(notepadBody("x")).toContain('data-surface="notepad-body"');
  });
  test("noteAppendOp: committed append to notepad-body, grade follows provenance", () => {
    expect(noteAppendOp("a", "ai")).toMatchObject({ target: "notepad-body", op: "append", provenance: "ai", commit: "committed" });
    expect(noteAppendOp("a", "user").html).not.toContain("data-grade");
  });
  test("noteReplaceOp: rebuilds the body wrapper via a replace op", () => {
    const op = noteReplaceOp("a", "user");
    expect(op).toMatchObject({ target: "notepad-body", op: "replace", provenance: "user", commit: "committed" });
    expect(op.html).toContain('data-surface="notepad-body"');
  });
});

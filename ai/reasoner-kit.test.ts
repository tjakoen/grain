// grain/ai/reasoner-kit.test.ts — the exported reasoner primitives. These are the shapes a
// consumer's real model composes with (and the stub dogfoods), so pin their contract.
import { test, expect, describe } from "bun:test";
import {
  esc, chatBubble, chatBody, narrationLine,
  userMessageOp, aiBubbleOp, typeToken, settleOp, replaceBodyOp, narrateOp, spotlightOp,
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
});

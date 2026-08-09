// crumb/core/prompt.test.ts — the prompt card: its grammar, and the text it composes.
import { test, expect } from "bun:test";
import { parseTour } from "./schema.ts";
import { composePrompt, templateTokens } from "./prompt.ts";

const tour = (body: string) => parseTour(`---\nmode: dev\ntitle: "Nav drawer"\nroute: /\n---\n${body}`, "review-drawer");

const WALK = "## nav:drawer\n- status: changed\n- review: it moved\nThe drawer.\n";

test("a `## prompt` section parses into a card and is not a step", () => {
  const { tour: t, errors } = tour(
    `${WALK}\n## prompt\nTell me what I could not check myself.\n` +
    "- ask: looked-off | What did not look right?\n" +
    "- ask: next | What should change?\n" +
    "- template: Continue the {title} review.\\nOff: {looked-off}\\nNext: {next}\n" +
    "- handoff: https://claude.ai/new?q={payload}\n",
  );
  expect(errors).toEqual([]);
  expect(t.steps.map((s) => s.surface)).toEqual(["nav:drawer"]);
  expect(t.prompt?.asks).toEqual([
    { id: "looked-off", label: "What did not look right?" },
    { id: "next", label: "What should change?" },
  ]);
  expect(t.prompt?.intro).toBe("Tell me what I could not check myself.");
  expect(t.prompt?.template).toContain("\n");            // `\n` in the source is a real newline
  expect(t.prompt?.handoff).toBe("https://claude.ai/new?q={payload}");
});

test("a tour with no prompt section gets a null card and no complaint", () => {
  const { tour: t, errors } = tour(WALK);
  expect(t.prompt).toBeNull();
  expect(errors).toEqual([]);
});

test("a prompt section with no template is reported, because there is nothing to hand back", () => {
  const { errors } = tour(`${WALK}\n## prompt\n- ask: a | Anything?\n`);
  expect(errors.some((e) => e.field === "prompt.template")).toBe(true);
});

test("a template token that is not an ask id is reported", () => {
  const { errors } = tour(`${WALK}\n## prompt\n- ask: a | Anything?\n- template: {a} and {b}\n`);
  expect(errors.find((e) => e.field === "prompt.template")?.message).toContain("{b}");
});

test("malformed and duplicate asks are reported and dropped, the rest survive", () => {
  const { tour: t, errors } = tour(
    `${WALK}\n## prompt\n- ask: no-question\n- ask: a b | spaces in the id\n- ask: ok | Fine?\n- ask: ok | Again?\n- template: {ok}\n`,
  );
  expect(t.prompt?.asks).toEqual([{ id: "ok", label: "Fine?" }]);
  expect(errors.filter((e) => e.field === "prompt.ask")).toHaveLength(3);
});

test("two prompt sections: the first wins, and it says so", () => {
  const { tour: t, errors } = tour(`${WALK}\n## prompt\n- template: one\n\n## prompt\n- template: two\n`);
  expect(t.prompt?.template).toBe("one");
  expect(errors.some((e) => e.field === "prompt")).toBe(true);
});

test("`- ask:` inside a real step stays prose instead of vanishing", () => {
  const { tour: t } = tour("## nav:drawer\n- status: changed\n- review: it moved\n- ask: a | not a prompt section\n");
  expect(t.steps[0].say).toContain("ask: a");
});

test("templateTokens lists every token once, in order", () => {
  expect(templateTokens("{title}: {a} then {b} then {a}")).toEqual(["title", "a", "b"]);
});

test("composePrompt fills answers and the tour's own fields", () => {
  const composed = composePrompt(
    "Continue the {title} review ({tour}).\nOff: {looked-off}",
    { id: "review-drawer", title: "Nav drawer" },
    { "looked-off": "  the dock clips it  " },
  );
  expect(composed).toBe("Continue the Nav drawer review (review-drawer).\nOff: the dock clips it");
});

test("a blank or missing answer leaves its token visible, so a half-answered card still reads", () => {
  const composed = composePrompt("Off: {a}. Next: {b}. Huh: {c}", { id: "t", title: "T" }, { a: "x", b: "   " });
  expect(composed).toBe("Off: x. Next: {b}. Huh: {c}");
});

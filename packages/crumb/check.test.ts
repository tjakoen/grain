// crumb/check.test.ts — the tours lint. Pure over the loader's output, so the fixtures are parsed
// tours rather than files on disk.
import { test, expect } from "bun:test";
import { checkLoaded } from "./check.ts";
import { parseTour } from "./core/schema.ts";
import type { LoadedTour } from "./loader.ts";

const load = (raw: string, id: string): LoadedTour => {
  const { tour, errors } = parseTour(raw, id);
  return { tour, raw, errors };
};

const DEMO = `---
id: welcome
mode: demo
title: "A demo"
route: /
---
Intro.

## screen
Just narration, which is all a demo step owes.
`;

const DEV_GOOD = `---
id: review-thing
mode: dev
title: "Review: the thing"
route: /
---
Intro.

## figure:ratio
- status: needs-verification
- review: The bar got a guess marker.
- verify: Drag it, then reveal.
Narration.
`;

const DEV_BARE = `---
id: review-bare
mode: dev
title: "Review: the bare one"
route: /
---
Intro.

## figure:ratio
Narration only, no review and no status.
`;

test("a clean tour reports its step count and mode", () => {
  const result = checkLoaded([load(DEMO, "welcome")], []);
  expect(result.ok).toBe(true);
  expect(result.lines[0]).toContain("welcome — 1 step(s), demo");
});

test("duplicate ids fail", () => {
  const result = checkLoaded([load(DEMO, "welcome")], ["welcome"]);
  expect(result.ok).toBe(false);
  expect(result.lines[0]).toContain("duplicate tour id");
});

test("an empty folder is reported, not silently passed as clean", () => {
  const result = checkLoaded([], []);
  expect(result.lines).toContain("no tours found");
});

// ---- the dev-mode contract --------------------------------------------------

test("a dev step carrying review and status passes", () => {
  const result = checkLoaded([load(DEV_GOOD, "review-thing")], []);
  expect(result.ok).toBe(true);
});

test("a dev step with NO review and NO status fails the lint", () => {
  const result = checkLoaded([load(DEV_BARE, "review-bare")], []);
  expect(result.ok).toBe(false);
  expect(result.lines.join("\n")).toContain("dev step with no review and no status");
  expect(result.lines.join("\n")).toContain("figure:ratio");
});

test("either one alone is enough — a status with no prose still says something", () => {
  const statusOnly = DEV_BARE.replace("## figure:ratio\n", "## figure:ratio\n- status: known-issue\n");
  expect(checkLoaded([load(statusOnly, "review-bare")], []).ok).toBe(true);
});

test("the same bare step in a DEMO tour is fine — demo steps owe no review", () => {
  const asDemo = DEV_BARE.replace("mode: dev", "mode: demo");
  expect(checkLoaded([load(asDemo, "review-bare")], []).ok).toBe(true);
});

// ---- the prompt card --------------------------------------------------------

const withPrompt = (section: string) => `${DEV_GOOD}\n## prompt\n${section}`;

test("a prompt card whose template uses every ask passes", () => {
  const result = checkLoaded([load(withPrompt("- ask: off | What looked off?\n- template: {title}: {off}\n"), "review-thing")], []);
  expect(result.ok).toBe(true);
});

test("an ask the template never uses fails — the answer would be thrown away", () => {
  const result = checkLoaded([load(withPrompt("- ask: off | What looked off?\n- ask: next | And next?\n- template: {off}\n"), "review-thing")], []);
  expect(result.ok).toBe(false);
  expect(result.lines.join("\n")).toContain('ask "next" is never used');
});

test("a prompt card with no asks at all is fine — a fixed prompt is still a handoff", () => {
  expect(checkLoaded([load(withPrompt("- template: Continue the {title} review.\n"), "review-thing")], []).ok).toBe(true);
});

// ---- prefill: what the door would refuse, and the staged-with-no-say trap ---

const withPrefill = (line: string) => `---
id: contact
mode: demo
title: "Contact"
route: /
---
Intro.

## field:contact-message
- prefill: ${line}
Some prose about the field.
`;

test("an over-cap prefill is flagged, with the count and the cap", () => {
  const over = "x".repeat(2001);
  const result = checkLoaded([load(withPrefill(over), "contact")], []);
  expect(result.ok).toBe(false);
  expect(result.lines.join("\n")).toContain("2001 chars, over the 2000-char cap");
});

test("a control character in a prefill is flagged as the door would see it", () => {
  const result = checkLoaded([load(withPrefill("bell\x07"), "contact")], []);
  expect(result.ok).toBe(false);
  expect(result.lines.join("\n")).toContain("control characters");
});

test("a staged step with an empty say is flagged — a staged screen needs prose or it reads as real", () => {
  const raw = `---
id: contact
mode: demo
title: "Contact"
route: /
---
## field:contact-message
- prefill: Hi TJ, about grain.
`;
  const result = checkLoaded([load(raw, "contact")], []);
  expect(result.ok).toBe(false);
  expect(result.lines.join("\n")).toContain("stages a value but has no `say`");
});

test("a clean staged tour — safe value, non-empty say — passes", () => {
  const result = checkLoaded([load(withPrefill("Hi TJ, about grain."), "contact")], []);
  expect(result.ok).toBe(true);
});

test("an ask with one option is flagged: a choice of one is a statement wearing a control", () => {
  const { ok, lines } = checkLoaded(
    [load(`---\nmode: dev\ntitle: T\nroute: /\n---\n## nav:x\n- status: changed\n- review: r\nP\n\n## prompt\n- ask: lane | Which? | gated\n- template: {lane}\n`, "solo")],
    [],
  );
  expect(ok).toBe(false);
  expect(lines.join("\n")).toContain("one option");
});

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

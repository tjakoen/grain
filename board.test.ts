// proof/board.test.ts — the pure board renderer. No server, no fs (builds LoadedPlans by hand).
import { test, expect } from "bun:test";
import { renderBoard, renderPlanHeader, boardPage } from "./board.ts";
import type { LoadedPlan } from "./loader.ts";
import type { Plan } from "./core/types.ts";

function loaded(over: Partial<Plan>, extra: Partial<LoadedPlan> = {}): LoadedPlan {
  return {
    plan: {
      id: "p", status: "todo", track: null, depends: [], touches: [], owner: "ai",
      title: "P", tasks: [], body: "", ...over,
    },
    raw: "", errors: [], lastModified: null, ...extra,
  };
}

test("renders a column per status with the right cards", () => {
  const html = renderBoard([
    loaded({ id: "a", status: "doing", title: "Alpha" }),
    loaded({ id: "b", status: "done", title: "Beta" }),
  ]);
  expect(html).toContain('data-status="doing"');
  expect(html).toContain('data-status="done"');
  expect(html).toContain("Alpha");
  expect(html).toContain('href="/plan/a"');
});

test("card shows task progress and the owner mark", () => {
  const html = renderBoard([
    loaded({ id: "a", status: "doing", tasks: [{ text: "x", done: true }, { text: "y", done: false }], owner: "human" }),
  ]);
  expect(html).toContain("1/2 tasks");
  expect(html).toContain('data-owner="human"');
});

test("touches render as chips", () => {
  const html = renderBoard([loaded({ id: "a", touches: ["grain/ai/contract.ts"] })]);
  expect(html).toContain("grain/ai/contract.ts");
  expect(html).toContain("proof-card__chip");
});

test("a plan with parse errors is flagged, not dropped", () => {
  const html = renderBoard([loaded({ id: "a" }, { errors: [{ field: "status", message: "bad" }] })]);
  expect(html).toContain("proof-card__flag");
  expect(html).toContain("1 issue");
});

test("card content is HTML-escaped (no injection through a title)", () => {
  const html = renderBoard([loaded({ id: "a", title: "<script>x</script>" })]);
  expect(html).not.toContain("<script>x</script>");
  expect(html).toContain("&lt;script&gt;");
});

test("an empty column renders a placeholder, not a gap", () => {
  const html = renderBoard([loaded({ id: "a", status: "todo" })]);
  expect(html).toContain("proof-col__empty");   // doing/done/blocked are empty
});

test("plan header lists the frontmatter facts", () => {
  const html = renderPlanHeader(loaded({ id: "a", status: "doing", track: "A", depends: ["b"], touches: ["x.ts"] }, { lastModified: "2026-07-08T00:00:00Z" }));
  expect(html).toContain("Status");
  expect(html).toContain("Track");
  expect(html).toContain("Depends on");
  expect(html).toContain("2026-07-08");
});

test("boardPage links every stylesheet it's given", () => {
  const page = boardPage("t", "<p>body</p>", ["/styles/variables.css", "/proof.css"]);
  expect(page).toContain('<link rel="stylesheet" href="/styles/variables.css">');
  expect(page).toContain('<link rel="stylesheet" href="/proof.css">');
  expect(page).toContain('data-grade="smooth"');
});

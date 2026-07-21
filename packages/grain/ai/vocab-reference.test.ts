// grain/ai/vocab-reference.test.ts
import { test, expect } from "bun:test";
import { buildVocabReference, RENDER_OP_KINDS } from "./vocab-reference.ts";
import { ACTIONS } from "./contract.ts";

// File-relative (not cwd-relative) so grain's own suite resolves whether grain/ is a subdir
// of the monorepo or the repo root after the split (SPLIT-PLAN.md).
const VARIABLES_CSS = import.meta.dir + "/../styles/variables.css";

test("renders every ACTIONS entry as a row — never hand-copied", async () => {
  const html = await buildVocabReference(VARIABLES_CSS);
  for (const name of Object.keys(ACTIONS)) expect(html).toContain(`<code>${name}</code>`);
});

test("renders each verb's payload schema + description — derived, not hand-copied", async () => {
  const html = await buildVocabReference(VARIABLES_CSS);
  // a required text field renders as text*:string; the description column carries the prose
  expect(html).toContain(`<code>text*:string</code>`);
  expect(html).toContain(ACTIONS["note.append"].description);
  // a no-argument verb reads "no args", not a blank cell
  expect(html).toContain("no args");
  // MCP-style hint flags render too (note.replace is destructive + idempotent)
  expect(html).toContain(`<code>destructive</code>`);
  expect(html).toContain(`<code>idempotent</code>`);
});

test("renders the token slots read from variables.css", async () => {
  const html = await buildVocabReference(VARIABLES_CSS);
  expect(html).toContain("--ink");
  expect(html).toContain("--paper");
});

// DRIFT GUARD: RENDER_OP_KINDS can't be derived from a runtime value (RenderOpKind is a
// pure type alias), so it's hand-maintained in vocab-reference.ts — this test fails loudly
// the moment contract.ts's union changes without a matching update here.
test("RENDER_OP_KINDS matches contract.ts's RenderOpKind union", async () => {
  const src = await Bun.file(new URL("./contract.ts", import.meta.url)).text();
  const m = src.match(/export type RenderOpKind\s*=\s*([^;]+);/);
  expect(m).not.toBeNull();
  const declared = new Set([...m![1].matchAll(/"([a-z]+)"/g)].map((x) => x[1]));
  const listed = new Set(RENDER_OP_KINDS.map((o) => o.kind));
  expect(listed).toEqual(declared);
});

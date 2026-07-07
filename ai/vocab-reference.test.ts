// grain/ai/vocab-reference.test.ts
import { test, expect } from "bun:test";
import { buildVocabReference, RENDER_OP_KINDS } from "./vocab-reference.ts";
import { ACTIONS } from "./contract.ts";

test("renders every ACTIONS entry as a row — never hand-copied", async () => {
  const html = await buildVocabReference("grain/styles/variables.css");
  for (const name of Object.keys(ACTIONS)) expect(html).toContain(`<code>${name}</code>`);
});

test("renders the token slots read from variables.css", async () => {
  const html = await buildVocabReference("grain/styles/variables.css");
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

// grain/scripts/ai-dispatch.test.ts — ai-dispatch.js is a browser-native IIFE (DOM globals,
// EventSource, crypto.randomUUID at load time) that can't be imported into a bun test — see its
// own file header, "the ONE accepted bit of client JS". What CAN be verified without a browser:
// that its two intentional, self-contained COPIES of grain rules (the navigate href guard, the
// settle-time markdown renderer) stay byte-identical to their canonical, unit-tested sources.
//
// DRIFT GUARD, same technique as ai/vocab-reference.test.ts's RENDER_OP_KINDS check: read both
// files as text and compare the regex LITERALS verbatim. CLAUDE.md lesson #5 — a contract that can
// silently drift needs a test that catches it, not just a patched instance.
import { test, expect } from "bun:test";

const read = (rel: string) => Bun.file(new URL(rel, import.meta.url)).text();

test("ai-dispatch.js registers a case for every RenderOpKind contract.ts declares", async () => {
  const [dispatch, contract] = await Promise.all([read("./ai-dispatch.js"), read("../ai/contract.ts")]);
  const m = contract.match(/export type RenderOpKind\s*=\s*([^;]+);/);
  expect(m).not.toBeNull();
  const kinds = [...m![1].matchAll(/"([a-z]+)"/g)].map((x) => x[1]);
  expect(kinds).toContain("navigate");   // sanity: this test would be vacuous if contract.ts regressed
  for (const kind of kinds) expect(dispatch).toContain(`case "${kind}":`);
});

test("SAFE_NAV_HREF in ai-dispatch.js matches contract.ts's isSafeNavigateHref regex verbatim", async () => {
  const [dispatch, contract] = await Promise.all([read("./ai-dispatch.js"), read("../ai/contract.ts")]);
  const dispatchRe = dispatch.match(/const SAFE_NAV_HREF = (\/.*\/);/)?.[1];
  const contractRe = contract.match(/const SAFE_NAV_HREF = (\/.*\/);/)?.[1];
  expect(dispatchRe).toBeTruthy();
  expect(contractRe).toBeTruthy();
  expect(dispatchRe).toBe(contractRe);
});

test("ai-dispatch.js's markdown regex rules match ai/markdown.ts's verbatim", async () => {
  const [dispatch, markdown] = await Promise.all([read("./ai-dispatch.js"), read("../ai/markdown.ts")]);
  const rules = ["CODE_RE", "LINK_RE", "STRONG_RE", "EM_RE", "LIST_ITEM_RE", "BLOCK_SPLIT_RE"];
  for (const name of rules) {
    const dRe = dispatch.match(new RegExp(`const MD_${name} = (\\/.*\\/[a-z]*);`))?.[1];
    const mRe = markdown.match(new RegExp(`const ${name} = (\\/.*\\/[a-z]*);`))?.[1];
    expect(dRe, `MD_${name} missing or reformatted in ai-dispatch.js`).toBeTruthy();
    expect(mRe, `${name} missing or reformatted in markdown.ts`).toBeTruthy();
    expect(dRe).toBe(mRe);
  }
});

test("a navigate op with an unsafe href is never assigned to location — asserted on the shared regex", async () => {
  const contract = await read("../ai/contract.ts");
  const src = contract.match(/const SAFE_NAV_HREF = (\/.*\/);/)?.[1];
  expect(src).toBeTruthy();
  // eslint-disable-next-line no-eval -- reconstructing the SAME literal ai-dispatch.js guards with
  const re = new Function(`return ${src};`)() as RegExp;
  expect(re.test("/notes")).toBe(true);
  expect(re.test("/")).toBe(true);
  expect(re.test("javascript:alert(1)")).toBe(false);
  expect(re.test("https://evil.example")).toBe(false);
  expect(re.test("//evil.example")).toBe(false);
  expect(re.test("/\\evil.example")).toBe(false);
});

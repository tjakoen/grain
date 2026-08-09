// crumb/crumb-live.test.ts — crumb-live.js is a browser-native module (DOM globals at load time, and
// an absolute host-served import) so it cannot be imported into a bun test. What CAN be verified
// without a browser is that its one mirrored rule stays identical to the unit-tested source, and that
// the navigation call still hands over the WHOLE target. Same technique, and same reason, as
// grain/scripts/ai-dispatch.test.ts's SAFE_NAV_HREF guard.
import { test, expect } from "bun:test";

const read = (rel: string) => Bun.file(new URL(rel, import.meta.url)).text();

/** The body of `function needsNavigation(...) { … }` / `export function needsNavigation(...) { … }`,
 *  with TypeScript's parameter and return annotations removed so the two are comparable as text. */
function needsNavigationBody(src: string): string | null {
  const m = src.match(/function needsNavigation\([^)]*\)[^{]*\{\n([\s\S]*?)\n\}/);
  return m ? m[1] : null;
}

test("needsNavigation in crumb-live.js is identical to core/nav.ts's", async () => {
  const [client, core] = await Promise.all([read("./crumb-live.js"), read("./core/nav.ts")]);
  const clientBody = needsNavigationBody(client);
  const coreBody = needsNavigationBody(core);
  expect(clientBody, "needsNavigation missing or reformatted in crumb-live.js").toBeTruthy();
  expect(coreBody, "needsNavigation missing or reformatted in core/nav.ts").toBeTruthy();
  expect(clientBody).toBe(coreBody);
});

test("routeOf in crumb-live.js is identical to core/nav.ts's", async () => {
  const [client, core] = await Promise.all([read("./crumb-live.js"), read("./core/nav.ts")]);
  const body = (src: string) => src.match(/routeOf = \(pathname[^)]*\)[^=]*=> (.+);/)?.[1];
  expect(body(client)).toBeTruthy();
  expect(body(core)).toBeTruthy();
  expect(body(client)).toBe(body(core));
});

test("composePrompt in crumb-live.js is identical to core/prompt.ts's", async () => {
  const [client, core] = await Promise.all([read("./crumb-live.js"), read("./core/prompt.ts")]);
  const body = (src: string) => src.match(/function composePrompt\([\s\S]*?\)[^{]*\{\n([\s\S]*?)\n\}/)?.[1];
  expect(body(client), "composePrompt missing or reformatted in crumb-live.js").toBeTruthy();
  expect(body(core), "composePrompt missing or reformatted in core/prompt.ts").toBeTruthy();
  expect(body(client)).toBe(body(core));
});

test("the token regex is identical on both sides", async () => {
  const [client, core] = await Promise.all([read("./crumb-live.js"), read("./core/prompt.ts")]);
  const re = (src: string) => src.match(/PROMPT_TOKEN = (\/.*\/[a-z]*);/)?.[1];
  expect(re(client)).toBeTruthy();
  expect(re(client)).toBe(re(core));
});

test("the prompt card never submits: no form, no fetch, no clipboard from the card path", async () => {
  const client = await read("./crumb-live.js");
  // the design law, held as source text: the card composes text and offers it. Anything that posted
  // it somewhere would be a write the tour is not allowed to make.
  expect(client).not.toContain("requestSubmit");
  expect(client).not.toContain("navigator.clipboard");
  expect(client).toContain("readonly");
});

test("resume() navigates to the whole target, not a normalized pathname", async () => {
  const client = await read("./crumb-live.js");
  // the fix: assign(target) keeps declared query/fragment state; assign(routeOf(target)) dropped it,
  // and the old `routeOf(target) !== routeOf(location.pathname)` compare reloaded forever.
  expect(client).toContain("needsNavigation(target, location)");
  expect(client).toContain("location.assign(target)");
  expect(client).not.toContain("location.assign(need)");
});

/** The body of `function prefillStep(...) { … }`, the one function in this module allowed to call
 *  the door. Extracted so the design law — a prefill goes through door.submit, never a direct
 *  `.value =` assignment — is held by an assertion instead of only a comment. */
function prefillStepBody(src: string): string | null {
  const m = src.match(/function prefillStep\([^)]*\)[^{]*\{\n([\s\S]*?)\n\}/);
  return m ? m[1] : null;
}

test("prefillStep is the only write a tour makes, and it goes through the door", async () => {
  const client = await read("./crumb-live.js");
  const body = prefillStepBody(client);
  expect(body, "prefillStep missing or reformatted in crumb-live.js").toBeTruthy();
  expect(body).toContain("door.submit(");
  expect(body).toContain('"field.set"');
  // the design law, held as source text (PLAN.md, amended 2026-08-09): the door is the only write.
  // A direct `el.value = …` assignment would be the forbidden shortcut, by name.
  expect(body).not.toMatch(/\.value\s*=[^=]/);
});

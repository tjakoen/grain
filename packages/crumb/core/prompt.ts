// crumb/core/prompt.ts — composing the prompt a review tour hands back.
// PURE: no DOM, no fetch, no clipboard. The client (crumb-live.js) mirrors `composePrompt` verbatim
// for the same reason it mirrors needsNavigation (a browser-native module cannot import a .ts
// sibling from a host asset path); crumb-live.test.ts drift-guards the copy.
//
// The design law still holds here. This collects input, but it writes nothing to the app: the answers
// become text in the browser, and where that text goes (a session, a tracker, nowhere) is the host's
// URL template to declare, never CRUMB's to know. Same vendor-neutrality as grain's handoff.js.

/** Tokens a template may use besides the ask ids: the tour's own title and id. */
export const TOUR_PROMPT_TOKENS = ["title", "tour"] as const;

const PROMPT_TOKEN = /\{([a-z0-9][a-z0-9_-]*)\}/gi;

/** Every `{token}` a template references, in order, deduplicated. */
export function templateTokens(template: string): string[] {
  return [...new Set([...template.matchAll(PROMPT_TOKEN)].map((m) => m[1]))];
}

/**
 * Fill a template from the answers plus the tour's own fields. An answer that is missing or blank
 * leaves the token's own text in place rather than an empty hole, so a half-answered card still
 * composes into something a person can read and finish by hand. Unknown tokens are left alone for
 * the same reason: silently deleting text the author wrote is worse than showing it.
 */
export function composePrompt(
  template: string,
  tour: { id: string; title: string },
  answers: Record<string, string>,
): string {
  return template.replace(PROMPT_TOKEN, (whole, token) => {
    if (token === "title") return tour.title;
    if (token === "tour") return tour.id;
    const answer = answers[token];
    return answer && answer.trim() !== "" ? answer.trim() : whole;
  });
}

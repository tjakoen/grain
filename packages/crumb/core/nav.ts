// crumb/core/nav.ts — the one navigation decision a tour makes, as pure data.
// PURE: no DOM, no location, no fs. The client (crumb-live.js) mirrors `needsNavigation` verbatim
// because it is a browser-native module that cannot import a .ts sibling from a host's asset path
// (its only import is the host-served /scripts/ai-spotlight.js). The mirror is drift-guarded by
// crumb-live.test.ts, the same technique grain uses for SAFE_NAV_HREF in its dispatcher.
//
// Why this module exists at all: the comparison used to be `routeOf(target) !== routeOf(pathname)`,
// which compares a target that may carry a query string or a fragment against a bare pathname. The
// two can never be equal, so resume() navigated, the page loaded, resume() re-fired, and it
// navigated again: an infinite reload for any step whose `at` declared query state. That also made
// the cheapest way to preset a page's own state unusable, which is why the fix comes first in
// plans/crumb-prefilled-demo.md (portfolio).

/** The current location, as the three parts the decision needs. `location` satisfies this. */
export interface Here {
  pathname: string;
  search: string;   // "" or "?a=b"
  hash: string;     // "" or "#frag"
}

/** Normalize a pathname for comparison: drop trailing slashes, and keep the root as "/". */
export const routeOf = (pathname: string): string => (pathname.replace(/\/+$/, "") || "/");

/**
 * Should the tour navigate to reach `target`?
 *
 * Three cases, and the middle one is the whole point:
 *  - a different pathname: yes, go.
 *  - the same pathname, but the target DECLARES query or fragment state the current URL does not
 *    already carry: yes, go. This is what lets a step preset a page through the host's own URL.
 *  - the same pathname and the target declares nothing: stay. A step that names no query state has
 *    no opinion about the host's own params, so they survive (the linkable-tour contract: a tour
 *    must not strip the params of the page it was launched from).
 */
export function needsNavigation(target: string, here: Here): boolean {
  const cut = target.search(/[?#]/);
  const path = routeOf(cut < 0 ? target : target.slice(0, cut));
  const rest = cut < 0 ? "" : target.slice(cut);
  if (path !== routeOf(here.pathname)) return true;
  return rest !== "" && rest !== here.search + here.hash;
}

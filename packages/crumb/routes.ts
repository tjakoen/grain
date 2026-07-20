// crumb/routes.ts — CRUMB as a MOUNTABLE LAYER (mirrors proof/routes.ts + mill's createMillRoutes).
// A transport-generic pathname handler `(pathname) => Promise<Response|null>`: null = "not my
// route, fall through", so a host (the portfolio) mounts it under a prefix and tries it before its
// own pages. CRUMB serves the tour DATA (parsed markdown → JSON); the client `crumb-live.js`
// (a static asset the host serves from this package) fetches it and drives the lamp + popover.
// The tour never writes to the app — these are all read routes (the design law, PLAN.md).
import { loadTour, loadTours } from "./loader.ts";
import type { Tour } from "./core/types.ts";

export interface CrumbRoutesDeps {
  /** the tours folder (absolute or cwd-relative) */
  toursDir: string;
  /** mount prefix, no trailing slash: default "/crumb" */
  prefix?: string;
}

export type CrumbRequestHandler = (pathname: string) => Promise<Response | null>;

/** A tour summary for the manifest (what a launcher lists) — the steps stay off the wire here. */
export interface TourSummary { id: string; title: string; mode: Tour["mode"]; route: string; steps: number; }

export function createCrumbRoutes(deps: CrumbRoutesDeps): CrumbRequestHandler {
  const prefix = deps.prefix ?? "/crumb";

  const relOf = (path: string): string | null => {
    if (path === prefix) return "/";
    if (path.startsWith(prefix + "/")) return path.slice(prefix.length);
    return null;
  };

  return async (pathname: string): Promise<Response | null> => {
    const path = pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
    const rel = relOf(path);
    if (rel === null) return null;

    // the manifest: every tour as a summary (a launcher reads this to list what's available)
    if (rel === "/tours.json" || rel === "/tours") {
      const { tours } = await loadTours(deps.toursDir);
      const summaries: TourSummary[] = tours.map(({ tour }) => ({
        id: tour.id, title: tour.title, mode: tour.mode, route: tour.route, steps: tour.steps.length,
      }));
      return Response.json(summaries);
    }

    // one tour's full data: /tours/<id>.json — what crumb-live.js fetches to run the tour
    const m = rel.match(/^\/tours\/([a-z0-9][a-z0-9._-]*)\.json$/);
    if (m) {
      const loaded = await loadTour(deps.toursDir, m[1]);
      if (!loaded) return new Response("tour not found", { status: 404 });
      return Response.json(loaded.tour);
    }

    return null;   // under our prefix but not a route we answer
  };
}

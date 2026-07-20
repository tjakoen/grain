// crumb/loader.ts — the filesystem side of CRUMB: read a `tours/` folder into parsed tours.
// The core (schema.ts) is pure; this is the ONLY module that touches disk, kept thin so the
// parsing stays trivially testable without fixtures (the same shape as proof/loader.ts).
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { parseTour } from "./core/schema.ts";
import type { Tour, TourError } from "./core/types.ts";

export interface LoadedTour {
  tour: Tour;
  raw: string;          // kept so a host can hand the body to MILL without re-reading
  errors: TourError[];
}

// Filename → tour id: the stem, lowercased, so `Review-Nav.md` addresses as `review-nav`.
// Traversal-safe: we only ever read `${dir}/${name}`.
const idOf = (file: string) => basename(file, ".md").toLowerCase();

// A tours/ folder carries a README (what `crumb init` writes to teach the schema) — not a tour.
const RESERVED = new Set(["readme.md"]);
const isTourFile = (name: string) => name.endsWith(".md") && !RESERVED.has(name.toLowerCase());

export interface LoadResult {
  tours: LoadedTour[];
  duplicates: string[];   // ids that appear on more than one file (case-folded)
}

// Read every `.md` in `dir` as a tour. A malformed tour is still loaded (best-effort, errors
// attached) so `crumb check` flags it rather than hiding it — nothing silently dropped.
export async function loadTours(dir: string): Promise<LoadResult> {
  let files: string[];
  try {
    files = (await readdir(dir)).filter(isTourFile).sort();
  } catch {
    return { tours: [], duplicates: [] };
  }
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const tours: LoadedTour[] = [];
  for (const file of files) {
    const id = idOf(file);
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
    const raw = await readFile(join(dir, file), "utf8");
    const { tour, errors } = parseTour(raw, id);
    tours.push({ tour, raw, errors });
  }
  return { tours, duplicates: [...duplicates] };
}

// Load ONE tour by id (the route handler's fast path — no need to parse the whole folder).
// Returns null when the id isn't a real, safe tour file.
export async function loadTour(dir: string, id: string): Promise<LoadedTour | null> {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(id)) return null;   // traversal-safe id shape
  let raw: string;
  try {
    raw = await readFile(join(dir, `${id}.md`), "utf8");
  } catch {
    return null;
  }
  const { tour, errors } = parseTour(raw, id);
  return { tour, raw, errors };
}

// mill/diagrams/cache.ts — a committed-to-git disk cache for rendered diagrams.
//
// The point of caching on disk rather than in memory: the cache directory is COMMITTED, so
// CI, the deploy, and the static export never need a browser. A contributor without
// chromium still serves every diagram; only a NEW diagram needs the heavy renderer, and
// only on the machine that authored it.
//
// Zero dependencies, and never throws. Every failure path — unreadable cache, unwritable
// directory, an inner renderer that dies — degrades to "no SVG", which the caller renders
// as an ordinary code block.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DiagramRenderer } from "./prepare.ts";

/**
 * Bumped by hand whenever MILL's own post-processing changes shape — the sentinel-to-token
 * substitution in particular. Committed SVGs are only valid for the transformation that
 * produced them, so a change here is what invalidates them. The renderer's own version
 * (mermaid's) is folded in by the caller via `versionTag`.
 */
export const CACHE_VERSION = "mill-diagrams-1";

const keyFor = (lang: string, source: string, versionTag: string): string =>
  createHash("sha1").update(`${lang}\0${source}\0${versionTag}`).digest("hex");

/**
 * Wrap a renderer with a disk cache. A hit returns the stored SVG and never calls the inner
 * renderer, which is what keeps chromium out of the deploy path. A miss calls the inner
 * renderer and writes any non-null result.
 *
 * Failures are deliberately NOT cached: a diagram that failed because a browser was missing
 * would otherwise be poisoned for the machine that could have rendered it.
 */
export function cachedRenderer(
  dir: string,
  inner: DiagramRenderer,
  versionTag: string = CACHE_VERSION,
): DiagramRenderer {
  let warnedWrite = false;

  return async (lang, source) => {
    const file = join(dir, `${keyFor(lang, source, versionTag)}.svg`);

    try {
      return await readFile(file, "utf8");
    } catch {
      // a miss (or an unreadable cache) — fall through to the renderer
    }

    let svg: string | null = null;
    try {
      svg = await inner(lang, source);
    } catch {
      svg = null;
    }
    if (!svg) return null;

    try {
      await mkdir(dir, { recursive: true });
      await writeFile(file, svg, "utf8");
    } catch (err) {
      if (!warnedWrite) {
        warnedWrite = true;
        console.warn(`[mill] diagram cache is not writable at ${dir}; rendering every time.`, err);
      }
    }

    return svg;
  };
}

// grain-lint-rules.ts: the tells of machine-made design, written as data.
//
// Each rule has one tier, and the tier decides what a finding does:
//   floor   blocks, with no override.
//   reflex  blocks unless the element (or an ancestor) carries
//           data-grain-lint-allow="rule-id: reason", so the excuse sits in the diff.
//   finish  reports and never blocks.
//
// A rule checks the source text (static, no browser, runs on every edit), the rendered page
// (a function executed inside the page at each width), or both. Rendered checks run in the
// browser, so they must be self-contained: no closures over this module. They reach shared
// helpers through window.__gl, which grain-lint.ts installs before any rule runs.
//
// Every rule carries a fix line that names the GRAIN token, component or pattern to use instead,
// so the agent's correction lands inside the system rather than in fresh CSS.

export type Tier = "floor" | "reflex" | "finish";

/** One raw hit from a check, before tier and allow handling. */
export interface Hit {
  selector: string;
  detail: string;
  /** The allow attribute that covers the hit, when the check could see one. */
  allow?: string;
  line?: number;
}

export interface StaticSource {
  path: string;
  text: string;
  kind: "html" | "css";
}

export interface Rule {
  id: string;
  tier: Tier;
  description: string;
  fix: string;
  static?: (src: StaticSource) => Hit[];
  /** Runs in the page. Receives the viewport width; returns hits. */
  rendered?: (width: number) => Hit[];
}

// ---- static helpers ---------------------------------------------------------------------------

const lineOf = (text: string, index: number): number => text.slice(0, index).split("\n").length;

/** Token files define colours on purpose; everything else must read them. */
const isTokenFile = (path: string): boolean =>
  /(variables|tokens|themes?)[^/]*\.css$/.test(path) || /\/themes\//.test(path);

const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/g;

/** Strip comments and data: URLs so neither trips a colour or spacing check. */
const cleanCss = (css: string): string =>
  css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "))
     .replace(/url\((["']?)data:[^)]*\)/g, m => m.replace(/[^\n]/g, " "));

/** Declarations outside custom-property definitions, with their offset in the text. */
function declarations(css: string): { prop: string; value: string; index: number }[] {
  const out: { prop: string; value: string; index: number }[] = [];
  const re = /([a-z-]+)\s*:\s*([^;{}]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    // Skip selector pseudo-classes such as a:hover { by requiring a terminator after the value.
    const after = css[m.index + m[0].length];
    if (after !== ";" && after !== "}") continue;
    out.push({ prop: m[1]!, value: m[2]!.trim(), index: m.index });
  }
  return out;
}

/** CSS blocks in a source: the whole file for CSS, every <style> body and style="" for HTML. */
function cssChunks(src: StaticSource): { css: string; offset: number; inline: boolean }[] {
  if (src.kind === "css") return [{ css: cleanCss(src.text), offset: 0, inline: false }];
  const chunks: { css: string; offset: number; inline: boolean }[] = [];
  for (const m of src.text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g))
    chunks.push({ css: cleanCss(m[1]!), offset: m.index! + m[0].indexOf(m[1]!), inline: false });
  for (const m of src.text.matchAll(/\sstyle="([^"]*)"/g))
    chunks.push({ css: m[1]! + ";", offset: m.index! + 8, inline: true });
  return chunks;
}

const allowIn = (tag: string): string | undefined =>
  /data-grain-lint-allow="([^"]*)"/.exec(tag)?.[1];

/** Visible text of a small HTML fragment. */
const textOf = (html: string): string => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

// ---- the rules --------------------------------------------------------------------------------

export const RULES: Rule[] = [
  // ======== floor ========
  {
    id: "contrast-aa",
    tier: "floor",
    description: "Text contrast below WCAG AA (4.5:1, or 3:1 for large text).",
    fix: "Use --color-fg for body text and --color-muted only where the theme keeps it at AA.",
    rendered: () => (window as any).__gl.contrast(),
  },
  {
    id: "focus-visible",
    tier: "floor",
    description: "A focusable element that shows no ring when it takes keyboard focus.",
    fix: "Keep grain's :focus-visible ring (the accent outline in global.css); never set outline: none without a replacement.",
    rendered: () => (window as any).__gl.focus(),
  },
  {
    id: "reduced-motion",
    tier: "floor",
    description: "Animation still running when the reader asked for reduced motion.",
    fix: "Drive motion from the --motion-* tokens and wrap it in @media (prefers-reduced-motion: no-preference).",
    rendered: () => {
      const gl = (window as any).__gl;
      const hits: Hit[] = [];
      for (const a of document.getAnimations()) {
        if (a.playState !== "running") continue;
        const t = a.effect?.getComputedTiming();
        const dur = Number(t?.duration ?? 0);
        if (dur <= 100 && t?.iterations !== Infinity) continue;
        const el = (a.effect as KeyframeEffect | null)?.target as Element | null;
        if (!el) continue;
        hits.push({ selector: gl.sel(el), detail: `${(a as any).animationName ?? "animation"} runs ${dur}ms under reduced motion`, allow: gl.allow(el) });
      }
      return hits;
    },
  },
  {
    id: "raw-color",
    tier: "floor",
    description: "A hardcoded colour where a semantic token belongs.",
    fix: "Read a semantic token: --color-fg, --color-muted, --color-bg, --color-surface, --color-accent, --color-danger.",
    static: src => {
      if (src.kind === "css" && isTokenFile(src.path)) return [];
      const hits: Hit[] = [];
      for (const chunk of cssChunks(src))
        for (const d of declarations(chunk.css)) {
          if (d.prop.startsWith("--")) continue;
          const v = d.value.replace(/var\([^)]*\)/g, "");
          if (!v.match(COLOR_LITERAL)) continue;
          hits.push({ selector: d.prop, detail: `${d.prop}: ${d.value}`, line: lineOf(src.text, chunk.offset + d.index) });
        }
      return hits;
    },
  },
  {
    id: "phone-overflow",
    tier: "floor",
    description: "Horizontal scroll or text clipped past the edge at phone width.",
    fix: "Let the column wrap: .container or .board with --page-pad, and min-width: 0 on flex children.",
    rendered: width => {
      if (width > 400) return [];
      const gl = (window as any).__gl;
      const hits: Hit[] = [];
      const root = document.scrollingElement!;
      if (root.scrollWidth > innerWidth + 1) {
        // Name the widest element that sticks out, which is what the agent has to fix.
        let worst: Element | null = null, right = innerWidth + 1;
        for (const el of document.body.querySelectorAll("*")) {
          const r = el.getBoundingClientRect();
          if (r.width && r.right > right && gl.visible(el)) { right = r.right; worst = el; }
        }
        hits.push({ selector: worst ? gl.sel(worst) : "html", detail: `page scrolls sideways: ${root.scrollWidth}px wide at ${innerWidth}px`, allow: worst ? gl.allow(worst) : undefined });
      }
      return hits;
    },
  },
  {
    id: "dead-form",
    tier: "floor",
    description: "A form whose submit goes nowhere: no action and no door to the contract.",
    fix: "Give the form an action, or route it through the contract door with data-surface so a submit raises an intent.",
    rendered: () => {
      const gl = (window as any).__gl;
      const hits: Hit[] = [];
      for (const f of document.querySelectorAll("form")) {
        const action = f.getAttribute("action");
        const real = action && action !== "#" && !action.startsWith("javascript:");
        if (real || f.closest("[data-surface]") || f.onsubmit || f.method === "dialog") continue;
        hits.push({ selector: gl.sel(f), detail: "form has no action and no data-surface", allow: gl.allow(f) });
      }
      return hits;
    },
  },

  // ======== reflex ========
  {
    id: "text-above-h1",
    tier: "reflex",
    description: "Text above the page's h1 other than breadcrumb navigation in the header.",
    fix: "Put context below the headline: .masthead, then .byline (name and date), then .rule.",
    static: src => {
      if (src.kind !== "html") return [];
      const hits: Hit[] = [];
      for (const m of src.text.matchAll(/<(p|span|div|small)\b([^>]*)>([^<]{1,120}(?:<[^/][^>]*>[^<]*<\/[^>]+>[^<]*)*)<\/\1>\s*<h1\b/g)) {
        hits.push({ selector: `${m[1]}${/class="([^"]*)"/.exec(m[2]!)?.[1]?.split(" ").map(c => "." + c).join("") ?? ""}`, detail: `"${textOf(m[3]!)}" sits above the h1`, allow: allowIn(m[2]!), line: lineOf(src.text, m.index!) });
      }
      return hits;
    },
    rendered: () => {
      const gl = (window as any).__gl;
      const h1 = document.querySelector("h1");
      if (!h1 || !gl.visible(h1)) return [];
      const hits: Hit[] = [];
      const STOP = "main, article, section, [role=main], .board, .container, body";
      let el: Element = h1;
      while (el.parentElement && !el.matches(STOP)) {
        for (let p = el.previousElementSibling; p; p = p.previousElementSibling) {
          if (p.matches("nav, [role=navigation], [aria-label*=readcrumb], script, style, template, .sr-only")) continue;
          const text = (p as HTMLElement).innerText?.trim();
          if (!text || !gl.visible(p)) continue;
          hits.push({ selector: gl.sel(p), detail: `"${text.slice(0, 60)}" sits above the h1`, allow: gl.allow(p) });
        }
        el = el.parentElement;
      }
      return hits;
    },
  },
  {
    id: "label-above-heading",
    tier: "reflex",
    description: "A short label sitting directly above a section heading.",
    fix: "Let the heading carry the section: .section-head, with any context in the first sentence below it.",
    static: src => {
      if (src.kind !== "html") return [];
      const hits: Hit[] = [];
      for (const m of src.text.matchAll(/<(p|span|div|small)\b([^>]*)>([^<]{1,40})<\/\1>\s*<h[23]\b/g))
        hits.push({ selector: m[1]!, detail: `"${m[3]!.trim()}" labels the heading below it`, allow: allowIn(m[2]!), line: lineOf(src.text, m.index!) });
      return hits;
    },
    rendered: () => {
      const gl = (window as any).__gl;
      const hits: Hit[] = [];
      for (const h of document.querySelectorAll("h2, h3")) {
        const p = h.previousElementSibling as HTMLElement | null;
        if (!p || p.matches("h1, h2, h3, h4, hr, nav, figure, img, ul, ol, table, pre") || !gl.visible(p) || !gl.visible(h)) continue;
        const text = p.innerText?.trim() ?? "";
        if (!text || text.length > 40 || p.children.length > 2) continue;
        const small = parseFloat(getComputedStyle(p).fontSize) < parseFloat(getComputedStyle(h).fontSize);
        if (small) hits.push({ selector: gl.sel(p), detail: `"${text}" labels ${h.tagName.toLowerCase()} "${(h as HTMLElement).innerText.trim().slice(0, 40)}"`, allow: gl.allow(p) });
      }
      return hits;
    },
  },
  {
    id: "tracked-caps",
    tier: "reflex",
    description: "Uppercase, letter-spaced text used as decoration.",
    fix: "Use sentence case at --text-sm; let weight or position carry the hierarchy, not tracking.",
    static: src => {
      const hits: Hit[] = [];
      for (const chunk of cssChunks(src)) {
        if (chunk.inline) {
          if (/text-transform\s*:\s*uppercase/.test(chunk.css) && /letter-spacing\s*:\s*(?!0|normal)/.test(chunk.css))
            hits.push({ selector: "style attribute", detail: "uppercase with letter-spacing", line: lineOf(src.text, chunk.offset) });
          continue;
        }
        for (const m of chunk.css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
          const body = m[2]!;
          if (/text-transform\s*:\s*uppercase/.test(body) && /letter-spacing\s*:\s*(?!0[;\s}]|normal|-)/.test(body))
            hits.push({ selector: m[1]!.trim().replace(/\s+/g, " "), detail: "uppercase with letter-spacing", line: lineOf(src.text, chunk.offset + m.index!) });
        }
      }
      return hits;
    },
    rendered: () => {
      const gl = (window as any).__gl;
      const hits: Hit[] = [];
      for (const el of gl.textElements() as HTMLElement[]) {
        const cs = getComputedStyle(el);
        if (cs.textTransform !== "uppercase") continue;
        const ls = parseFloat(cs.letterSpacing);
        if (!(ls > parseFloat(cs.fontSize) * 0.03)) continue;
        hits.push({ selector: gl.sel(el), detail: `"${el.innerText.trim().slice(0, 40)}" is tracked caps`, allow: gl.allow(el) });
      }
      return hits;
    },
  },
  {
    id: "accent-word",
    tier: "reflex",
    description: "One or two words in a headline picked out in another colour.",
    fix: "Keep the headline one ink (--color-fg); the one accent belongs to links and focus.",
    rendered: () => {
      const gl = (window as any).__gl;
      const hits: Hit[] = [];
      for (const h of document.querySelectorAll("h1, h2")) {
        const base = getComputedStyle(h).color;
        const whole = (h as HTMLElement).innerText.trim().length;
        for (const c of h.querySelectorAll("span, em, strong, mark, b, i")) {
          if (c.closest("a")) continue;
          const t = (c as HTMLElement).innerText.trim();
          if (!t || t.length > whole * 0.5) continue;
          if (getComputedStyle(c).color !== base)
            hits.push({ selector: gl.sel(c), detail: `"${t}" is coloured apart from its headline`, allow: gl.allow(c) });
        }
      }
      return hits;
    },
  },
  {
    id: "card-run",
    tier: "reflex",
    description: "Three or more identical boxed cards in a row, each with its own heading.",
    fix: "Ask whether a list (b-list) or a table carries this better; cards are for things a reader picks between.",
    rendered: () => {
      const gl = (window as any).__gl;
      const hits: Hit[] = [];
      for (const parent of document.querySelectorAll("body *")) {
        const kids = [...parent.children].filter(k => gl.visible(k));
        if (kids.length < 3) continue;
        const sig = (k: Element) => k.tagName + "." + [...k.classList].sort().join(".");
        if (new Set(kids.map(sig)).size !== 1) continue;
        const boxed = kids.every(k => {
          const cs = getComputedStyle(k);
          return (parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== "none" || cs.backgroundColor !== getComputedStyle(parent).backgroundColor)
            && k.querySelector("h2, h3, h4");
        });
        if (boxed) hits.push({ selector: gl.sel(parent), detail: `${kids.length} identical cards (${sig(kids[0]!).toLowerCase()})`, allow: gl.allow(parent) });
      }
      return hits;
    },
  },
  {
    id: "closing-signup",
    tier: "reflex",
    description: "A sign-up block that closes the page.",
    fix: "End on the content and the .rule; a subscribe offer is one underlined link in a sentence where it is earned.",
    rendered: () => {
      const gl = (window as any).__gl;
      const forms = [...document.querySelectorAll("form")].filter(f => f.querySelector("input[type=email]") && gl.visible(f));
      const last = forms.at(-1);
      if (!last) return [];
      // It closes the page when no visible text follows it in reading order.
      const after = (gl.textElements() as Element[]).some(el =>
        !last.contains(el) && (last.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) && !el.closest("footer, nav"));
      if (after) return [];
      return [{ selector: gl.sel(last), detail: "an email sign-up closes the page", allow: gl.allow(last) }];
    },
  },
  {
    id: "hero-overflow",
    tier: "reflex",
    description: "The headline does not land inside the first screen.",
    fix: "Use the masthead pattern at --display; drop the decorative block that pushes it down.",
    rendered: width => {
      if (width < 700) return [];
      const gl = (window as any).__gl;
      const h1 = document.querySelector("h1");
      if (!h1 || !gl.visible(h1)) return [];
      const r = h1.getBoundingClientRect();
      if (r.bottom + scrollY <= innerHeight) return [];
      return [{ selector: gl.sel(h1), detail: `h1 ends at ${Math.round(r.bottom + scrollY)}px, below the ${innerHeight}px first screen`, allow: gl.allow(h1) }];
    },
  },

  // ======== finish ========
  {
    id: "heading-widow",
    tier: "finish",
    description: "A heading whose last line is a single word.",
    fix: "h1 to h3 already set text-wrap: balance in global.css; do not override it.",
    rendered: () => {
      const gl = (window as any).__gl;
      const hits: Hit[] = [];
      for (const h of document.querySelectorAll("h1, h2, h3")) {
        if (!gl.visible(h)) continue;
        const words = gl.wordRects(h) as DOMRect[];
        if (words.length < 3) continue;
        const last = words.at(-1)!, prev = words.at(-2)!;
        if (last.top - prev.top > last.height / 2)
          hits.push({ selector: gl.sel(h), detail: `last line of "${(h as HTMLElement).innerText.trim().slice(0, 40)}" is one word`, allow: gl.allow(h) });
      }
      return hits;
    },
  },
  {
    id: "off-scale-space",
    tier: "finish",
    description: "A margin, padding or gap that is not on the spacing scale.",
    fix: "Use a --space-* step (or --page-pad for page gutters).",
    static: src => {
      if (src.kind === "css" && isTokenFile(src.path)) return [];
      const hits: Hit[] = [];
      for (const chunk of cssChunks(src))
        for (const d of declarations(chunk.css)) {
          if (!/^(margin|padding|gap|row-gap|column-gap)(-|$)/.test(d.prop)) continue;
          const v = d.value.replace(/var\([^)]*\)/g, "").replace(/calc\([^)]*\)/g, "").replace(/!important/, "");
          const raw = v.match(/(?<![\w.-])\d*\.?\d+(px|rem|em)\b/g)?.filter(x => parseFloat(x) !== 0 && !/^1px$/.test(x));
          if (raw?.length) hits.push({ selector: d.prop, detail: `${d.prop}: ${d.value}`, line: lineOf(src.text, chunk.offset + d.index) });
        }
      return hits;
    },
  },
  {
    id: "image-ratio",
    tier: "finish",
    description: "An image with no stated aspect ratio, so the page jumps as it loads.",
    fix: "Give the img width and height attributes, or set aspect-ratio on its frame.",
    rendered: () => {
      const gl = (window as any).__gl;
      const hits: Hit[] = [];
      for (const img of document.querySelectorAll("img")) {
        if (img.hasAttribute("width") && img.hasAttribute("height")) continue;
        if (getComputedStyle(img).aspectRatio !== "auto") continue;
        hits.push({ selector: gl.sel(img), detail: `img ${img.getAttribute("src")?.slice(0, 50) ?? ""} has no aspect ratio`, allow: gl.allow(img) });
      }
      return hits;
    },
  },
];

export const RULE_IDS = RULES.map(r => r.id);

/** Parse an allow attribute ("rule-a: reason; rule-b: reason") and say whether it excuses a rule. */
export function allowReason(attr: string | undefined, ruleId: string): string | undefined {
  if (!attr) return undefined;
  for (const part of attr.split(";")) {
    const [id, ...rest] = part.split(":");
    const reason = rest.join(":").trim();
    if (id?.trim() === ruleId && reason) return reason;
  }
  return undefined;
}

/**
 * The in-page helpers every rendered rule reaches through window.__gl. Shipped as a string so it
 * runs in the browser as written; grain-lint.ts evaluates it once per page load.
 */
export const PAGE_HELPERS = String.raw`
window.__gl = (() => {
  const esc = s => (window.CSS && CSS.escape) ? CSS.escape(s) : s;
  const sel = el => {
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && parts.length < 4; e = e.parentElement) {
      if (e.id) { parts.unshift("#" + esc(e.id)); break; }
      let p = e.tagName.toLowerCase();
      const cls = [...e.classList].filter(c => !/^(is-|has-)/.test(c)).slice(0, 2);
      if (cls.length) p += "." + cls.map(esc).join(".");
      else if (e.parentElement) {
        const same = [...e.parentElement.children].filter(s => s.tagName === e.tagName);
        if (same.length > 1) p += ":nth-of-type(" + (same.indexOf(e) + 1) + ")";
      }
      parts.unshift(p);
      if (e.tagName === "BODY") break;
    }
    return parts.join(" > ");
  };
  const allow = el => el.closest && el.closest("[data-grain-lint-allow]") ? el.closest("[data-grain-lint-allow]").getAttribute("data-grain-lint-allow") : undefined;
  const visible = el => {
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.opacity === "0") return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && !el.closest("[hidden], [aria-hidden=true], .sr-only");
  };
  const ownText = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  const textElements = () => [...document.body.querySelectorAll("*")].filter(el =>
    !el.matches("script, style, noscript, svg, svg *, template") && ownText(el) && visible(el));

  // Colours: normalise anything the browser can paint to RGBA through a 1x1 canvas.
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const rgba = c => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (top, under) => { const a = top[3]; return [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a), 1]; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = el => {
    const stack = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== "none" && !/grain|noise|svg/.test(cs.backgroundImage)) return null; // an image under text: unknowable here
      const c = rgba(cs.backgroundColor);
      if (c[3] > 0) { stack.push(c); if (c[3] >= 1) break; }
    }
    let bg = [255, 255, 255, 1];
    for (let i = stack.length - 1; i >= 0; i--) bg = over(stack[i], bg);
    return bg;
  };
  const contrast = () => {
    const hits = [];
    for (const el of textElements()) {
      const cs = getComputedStyle(el);
      const bg = bgOf(el); if (!bg) continue;
      const fg = over(rgba(cs.color), bg);
      const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700;
      const need = (size >= 24 || (bold && size >= 18.66)) ? 3 : 4.5;
      const r = ratio(fg, bg);
      if (r < need) hits.push({ selector: sel(el), detail: '"' + el.innerText.trim().slice(0, 40) + '" is ' + r.toFixed(2) + ":1, needs " + need + ":1", allow: allow(el) });
    }
    return hits;
  };
  const focus = () => {
    const hits = [];
    const els = [...document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex='-1'])")].filter(visible).slice(0, 60);
    for (const el of els) {
      const before = getComputedStyle(el);
      const was = [before.outlineStyle, before.outlineWidth, before.boxShadow, before.borderColor, before.backgroundColor].join("|");
      el.focus({ preventScroll: true, focusVisible: true });
      if (document.activeElement !== el) continue;
      const cs = getComputedStyle(el);
      const ring = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== "none";
      const now = [cs.outlineStyle, cs.outlineWidth, cs.boxShadow, cs.borderColor, cs.backgroundColor].join("|");
      const wrap = el.closest(".field");
      const wrapRing = wrap && (getComputedStyle(wrap).outlineStyle !== "none" || getComputedStyle(wrap).boxShadow !== "none");
      if (!ring && now === was && !wrapRing) hits.push({ selector: sel(el), detail: "no visible change on keyboard focus", allow: allow(el) });
      el.blur();
    }
    return hits;
  };
  const wordRects = el => {
    const rects = [];
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      for (const m of n.textContent.matchAll(/\S+/g)) {
        const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
        const b = r.getBoundingClientRect(); if (b.width) rects.push(b);
      }
    }
    return rects;
  };
  return { sel, allow, visible, textElements, contrast, focus, wordRects };
})();
`;

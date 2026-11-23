// grain/components/organisms/diagram/diagram.ts: planning diagrams drawn as inline SVG on the server.
//
// Four notations, each in its method's own shapes: crow's-foot for an ERD, Gane and Sarson for a
// DFD with trust boundaries, C4 for context and container views, and a flowchart for user flows.
// The module has three layers, and a consumer can stop at any of them:
//
//   1. geometry: text widths, where a line leaves a box, longest-path layering, crossing reduction,
//      and a label placer that steps a label away until it overlaps nothing already drawn;
//   2. notation shapes: one function per symbol (crow's-foot ends, process, store, external,
//      person, system, container, start, action, decision, end), each returning an SVG fragment;
//   3. renderers: erdDiagram, dfdDiagram and layeredDiagram take plain neutral data and return a
//      whole diagram inside diagramFrame, which DIAGRAM_SCRIPT gives pan, zoom and hover tracing.
//
// The palette is closed. Colour comes from the semantic tokens in diagram.css, so state is shown by
// line weight, dashes and words, never by a new hue. Every node and edge carries data-node or
// data-edge, and an edge names its two ends in data-ends, which is all the tracing script reads.

// ── geometry ───────────────────────────────────────────────────────────────────────────────────

export interface Box { id: string; x: number; y: number; w: number; h: number }
export type Point = [number, number];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export { esc as escapeDiagramText };

/** The approximate width of one 12px character, which every box size is derived from. */
export const CHAR_W = 6.8;
/** A box wide enough for the text plus padding, never narrower than min. */
export const textWidth = (s: string, min = 0) => Math.max(min, Math.ceil(s.length * CHAR_W) + 24);

export const centre = (b: Box): Point => [b.x + b.w / 2, b.y + b.h / 2];
export const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The point where a line from the box's centre toward (tx, ty) leaves the box. */
export function edgePoint(b: Box, tx: number, ty: number, shape: "rect" | "diamond" = "rect"): Point {
  const [cx, cy] = centre(b);
  const dx = tx - cx, dy = ty - cy;
  if (!dx && !dy) return [cx, cy];
  const hw = b.w / 2, hh = b.h / 2;
  const t = shape === "diamond"
    ? 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh)
    : Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  return [cx + dx * t, cy + dy * t];
}

/** Longest-path layering over a directed graph; a cycle cannot push a node past the last layer. */
export function layers(ids: string[], edges: [string, string][]): string[][] {
  const rank = new Map<string, number>(ids.map((id) => [id, 0]));
  for (let pass = 0; pass < ids.length; pass++) {
    let moved = false;
    for (const [a, b] of edges) {
      if (a === b || !rank.has(a) || !rank.has(b)) continue;
      const want = rank.get(a)! + 1;
      if (want > rank.get(b)! && want < ids.length) { rank.set(b, want); moved = true; }
    }
    if (!moved) break;
  }
  const out: string[][] = [];
  for (const id of ids) (out[rank.get(id)!] ??= []).push(id);
  return out.filter(Boolean);
}

/**
 * Reorders each layer so a node sits near the mean position of its neighbours in the layers either
 * side (the barycenter heuristic), sweeping down and up a few times. It changes order only, never
 * membership, and a node with no neighbours keeps its place, so an unconnected graph is unchanged.
 */
export function orderByConnection(rows: string[][], edges: [string, string][], sweeps = 4): string[][] {
  const out = rows.map((r) => [...r]);
  const nbrs = new Map<string, string[]>();
  for (const [a, b] of edges) {
    if (a === b) continue;
    (nbrs.get(a) ?? nbrs.set(a, []).get(a)!).push(b);
    (nbrs.get(b) ?? nbrs.set(b, []).get(b)!).push(a);
  }
  const pass = (i: number, ref: number[]) => {
    const pos = new Map<string, number>();
    for (const j of ref) out[j]?.forEach((id, k) => pos.set(id, k / Math.max(1, out[j]!.length - 1)));
    const row = out[i]!;
    const key = new Map(row.map((id, k) => {
      const ps = (nbrs.get(id) ?? []).map((n) => pos.get(n)).filter((p): p is number => p !== undefined);
      return [id, ps.length ? ps.reduce((s, p) => s + p, 0) / ps.length : k / Math.max(1, row.length - 1)];
    }));
    row.sort((a, b) => key.get(a)! - key.get(b)!);
  };
  for (let s = 0; s < sweeps; s++) {
    for (let i = 1; i < out.length; i++) pass(i, [i - 1]);
    for (let i = out.length - 2; i >= 0; i--) pass(i, [i + 1]);
  }
  return out;
}

/**
 * Collects the labels of one diagram. A label is offered at a point, steps up and down until its
 * box overlaps nothing already placed (nodes count, once added with avoid), and is drawn last, so a
 * node never hides one.
 */
export class LabelPlacer {
  private placed: Box[] = [];
  private out: string[] = [];
  avoid(...boxes: Box[]) { this.placed.push(...boxes); }
  place(x: number, y: number, text: string): Box | undefined {
    if (!text) return undefined;
    const w = textWidth(text) - 12;
    let box: Box = { id: "", x: x - w / 2, y: y - 9, w, h: 18 };
    for (let i = 1; i < 12 && this.placed.some((p) => overlaps(p, box)); i++) {
      const step = Math.ceil(i / 2) * 22 * (i % 2 ? 1 : -1);
      box = { ...box, y: y - 9 + step };
    }
    this.placed.push(box);
    this.out.push(`<g class="dg-elabel"><rect x="${box.x}" y="${box.y}" width="${w}" height="18" rx="3"/><text x="${x}" y="${box.y + 13}" text-anchor="middle">${esc(text)}</text></g>`);
    return box;
  }
  svg() { return `<g class="dg-labels">${this.out.join("")}</g>`; }
}

// ── frame ──────────────────────────────────────────────────────────────────────────────────────

const DEFS = `<defs><marker id="dg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="dg-arrowhead"/></marker></defs>`;

export interface FrameOptions { kind: string; width: number; height: number; label: string; hint?: string }

/** Wraps SVG content in the figure, toolbar and viewport that DIAGRAM_SCRIPT drives. */
export function diagramFrame(o: FrameOptions, inner: string): string {
  const W = Math.ceil(o.width), H = Math.ceil(o.height);
  const hint = o.hint ?? "Ctrl and scroll, or pinch, to zoom; drag to pan; hover to trace; click to open.";
  return `<figure class="diagram" data-diagram="${esc(o.kind)}">
  <div class="diagram__bar" role="toolbar" aria-label="Diagram controls">
    <button type="button" data-zoom="in" aria-label="Zoom in">+</button>
    <button type="button" data-zoom="out" aria-label="Zoom out">−</button>
    <button type="button" data-zoom="reset">Fit</button>
    <span class="diagram__hint">${esc(hint)}</span>
  </div>
  <svg class="diagram__svg" viewBox="0 0 ${W} ${H}" data-w="${W}" data-h="${H}" role="img" aria-label="${esc(o.label)}" xmlns="http://www.w3.org/2000/svg">${DEFS}${inner}</svg>
</figure>`;
}

/** A node or edge wrapper: a link when it has an href, a group otherwise, with a native tooltip. */
function wrap(attrs: { cls: string; node?: string; edge?: string; ends?: [string, string]; href?: string; title: string }, inner: string): string {
  const tag = attrs.href ? "a" : "g";
  const data = (attrs.node !== undefined ? ` data-node="${esc(attrs.node)}"` : "")
    + (attrs.edge !== undefined ? ` data-edge="${esc(attrs.edge)}"` : "")
    + (attrs.ends ? ` data-ends="${esc(attrs.ends[0])} ${esc(attrs.ends[1])}"` : "")
    + (attrs.href ? ` href="${esc(attrs.href)}"` : "");
  return `<${tag} class="${attrs.cls}"${data}><title>${esc(attrs.title)}</title>${inner}</${tag}>`;
}

// ── notation shapes ────────────────────────────────────────────────────────────────────────────

const title = (x: number, y: number, s: string, anchor = "middle") => `<text class="dg-title" x="${x}" y="${y}" text-anchor="${anchor}">${esc(s)}</text>`;
const sub = (x: number, y: number, s: string) => `<text class="dg-sub" x="${x}" y="${y}" text-anchor="middle">${esc(s)}</text>`;
const tag = (x: number, y: number, s: string, anchor = "middle") => `<text class="dg-tag" x="${x}" y="${y}" text-anchor="${anchor}">${esc(s)}</text>`;
const bar = (x: number, y: number) => `<line class="dg-card" x1="${x}" y1="${y - 7}" x2="${x}" y2="${y + 7}"/>`;

/** Crow's-foot cardinality ends. The end sits at (x, y) and the shape grows in direction dir (1 right, -1 left). */
export const crowsFoot = {
  /** Many: a foot spreading onto the box, with a bar behind it (one or more). */
  many: (x: number, y: number, dir: 1 | -1) => `<path class="dg-card" d="M${x},${y - 7} L${x + dir * 14},${y} L${x},${y + 7}"/>${bar(x + dir * 18, y)}`,
  /** One: a single bar. */
  one: (x: number, y: number, dir: 1 | -1) => bar(x + dir * 10, y),
  /** Exactly one: two bars. */
  exactlyOne: (x: number, y: number, dir: 1 | -1) => bar(x + dir * 9, y) + bar(x + dir * 15, y),
  /** Zero or one: a ring and a bar. */
  zeroOrOne: (x: number, y: number, dir: 1 | -1) => `<circle class="dg-card dg-ring" cx="${x + dir * 20}" cy="${y}" r="5"/>${bar(x + dir * 9, y)}`,
};

/** Gane and Sarson symbols. tagText is the P1 or D1 identifier the notation prints in the strip. */
export const ganeSarson = {
  /** A process: a rounded rectangle with an identifier strip across the top. */
  process: (b: Box, label: string, tagText: string) =>
    `<rect class="dg-box" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="12"/><path class="dg-rule" d="M${b.x},${b.y + 20} h${b.w}"/>${tag(b.x + b.w / 2, b.y + 14, tagText)}${title(b.x + b.w / 2, b.y + b.h / 2 + 10, label)}`,
  /** A data store: an open-ended rectangle with an identifier compartment. */
  store: (b: Box, label: string, tagText: string) =>
    `<rect class="dg-fill" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"/><path class="dg-rule" d="M${b.x + b.w},${b.y} H${b.x} V${b.y + b.h} H${b.x + b.w}"/><path class="dg-rule" d="M${b.x + 32},${b.y} V${b.y + b.h}"/>${tag(b.x + 16, b.y + b.h / 2 + 4, tagText)}${title(b.x + 32 + (b.w - 32) / 2, b.y + b.h / 2 + 5, label)}`,
  /** An external entity: a square with a heavier shadow edge. */
  external: (b: Box, label: string) =>
    `<rect class="dg-shadow" x="${b.x + 4}" y="${b.y + 4}" width="${b.w}" height="${b.h}"/><rect class="dg-box" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"/>${title(b.x + b.w / 2, b.y + b.h / 2 + 5, label)}`,
};

/** Text for a box: a bold label and an optional second line, centred around ty. */
function boxText(b: Box, label: string, second: string | undefined, ty = b.y + b.h / 2 + (second ? -2 : 5)): string {
  const cx = b.x + b.w / 2;
  return title(cx, ty, label) + (second ? sub(cx, ty + 16, second) : "");
}

/** C4 symbols. second is the bracketed line under the name, such as [Container: Bun]. */
export const c4 = {
  /** A person: a head over a rounded body. Needs a box about 84 high. */
  person: (b: Box, label: string, second?: string) => {
    const cx = b.x + b.w / 2;
    return `<circle class="dg-box" cx="${cx}" cy="${b.y + 14}" r="14"/><rect class="dg-box" x="${b.x}" y="${b.y + 30}" width="${b.w}" height="${b.h - 30}" rx="16"/>${boxText(b, label, second, b.y + 30 + (b.h - 30) / 2 + (second ? -2 : 5))}`;
  },
  /** The system in scope: a heavy outline, the weight standing in for the notation's fill colour. */
  system: (b: Box, label: string, second?: string) => `<rect class="dg-box dg-heavy" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6"/>${boxText(b, label, second)}`,
  /** A container inside the system boundary. */
  container: (b: Box, label: string, second?: string) => `<rect class="dg-box" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6"/>${boxText(b, label, second)}`,
  /** A system outside the scope: dashed, the dashes standing in for the notation's grey. */
  external: (b: Box, label: string, second?: string) => `<rect class="dg-box dg-dashed" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6"/>${boxText(b, label, second)}`,
};

/** Flowchart symbols. */
export const flowchart = {
  /** Start: a stadium. */
  start: (b: Box, label: string, second?: string) => `<rect class="dg-box" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.h / 2}"/>${boxText(b, label, second)}`,
  /** End: a stadium with a heavy outline, so it reads as terminal without a second colour. */
  end: (b: Box, label: string, second?: string) => `<rect class="dg-box dg-heavy" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.h / 2}"/>${boxText(b, label, second)}`,
  /** Action: a rounded rectangle. */
  action: (b: Box, label: string, second?: string) => `<rect class="dg-box" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6"/>${boxText(b, label, second)}`,
  /** Decision: a diamond. Edges leave it through edgePoint with shape "diamond". */
  decision: (b: Box, label: string, second?: string) => {
    const cx = b.x + b.w / 2;
    return `<path class="dg-box" d="M${cx},${b.y} L${b.x + b.w},${b.y + b.h / 2} L${cx},${b.y + b.h} L${b.x},${b.y + b.h / 2} z"/>${boxText(b, label, second)}`;
  },
  /** System step: the predefined-process box, a rectangle with a double rule at each side. */
  system: (b: Box, label: string, second?: string) => `<rect class="dg-box" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"/><path class="dg-rule" d="M${b.x + 10},${b.y} V${b.y + b.h} M${b.x + b.w - 10},${b.y} V${b.y + b.h}"/>${boxText(b, label, second)}`,
};

/** A dashed boundary with its label in the top-left corner: a trust boundary or a C4 system scope. */
export function boundary(b: Box, label: string, titleText = label): string {
  return `<g class="dg-boundary" data-node="${esc(b.id)}"><title>${esc(titleText)}</title><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="14"/>${tag(b.x + 14, b.y + 20, label, "start")}</g>`;
}

/** A straight connector with an arrow, plus a wide invisible stroke so it is easy to hover. */
export function arrow(p1: Point, p2: Point): string {
  const d = `M${p1[0]},${p1[1]} L${p2[0]},${p2[1]}`;
  return `<path class="dg-line" d="${d}" marker-end="url(#dg-arrow)"/><path class="dg-hit" d="${d}"/>`;
}

// ── renderer: ERD ──────────────────────────────────────────────────────────────────────────────

export interface ErdColumnIn { name: string; type?: string; pk?: boolean; fk?: boolean; nullable?: boolean }
export interface ErdEntityIn { id: string; columns: ErdColumnIn[]; tag?: string; stub?: boolean; href?: string; title?: string }
export type ErdEnd = "many" | "one" | "exactly-one" | "zero-or-one";
export interface ErdRelationIn {
  id: string; from: string; to: string; fromColumn?: string; toColumn?: string;
  /** The end at the referencing table, many by default. */
  fromEnd?: ErdEnd;
  /** The end at the referenced table, exactly one by default. */
  toEnd?: ErdEnd;
  optional?: boolean; href?: string; title?: string;
}
export interface ErdInput { entities: ErdEntityIn[]; relations: ErdRelationIn[]; selected?: string; label?: string }

const ROW = 20, HEAD = 30, ERD_W = 230;
const endShape = (end: ErdEnd, x: number, y: number, dir: 1 | -1) =>
  end === "many" ? crowsFoot.many(x, y, dir) : end === "one" ? crowsFoot.one(x, y, dir) : end === "zero-or-one" ? crowsFoot.zeroOrOne(x, y, dir) : crowsFoot.exactlyOne(x, y, dir);

/** A crow's-foot ERD. Referenced tables sit to the left of the tables that point at them. */
export function erdDiagram(input: ErdInput): string {
  const ents = new Map(input.entities.map((x) => [x.id, x]));
  const rels = input.relations.filter((r) => ents.has(r.from) && ents.has(r.to));
  const parentEdges: [string, string][] = rels.filter((r) => r.from !== r.to).map((r) => [r.to, r.from]);
  const cols = orderByConnection(layers([...ents.keys()], parentEdges), parentEdges);
  const GAPX = 120, GAPY = 36, PAD = 24;
  const boxes = new Map<string, Box>();
  let H = 0;
  cols.forEach((col, ci) => {
    let y = PAD;
    for (const id of col) {
      const h = HEAD + ents.get(id)!.columns.length * ROW + 8;
      boxes.set(id, { id, x: PAD + ci * (ERD_W + GAPX), y, w: ERD_W, h });
      y += h + GAPY;
    }
    H = Math.max(H, y);
  });
  const W = PAD * 2 + cols.length * ERD_W + (cols.length - 1) * GAPX;
  const rowY = (id: string, col = "") => {
    const b = boxes.get(id)!, i = ents.get(id)!.columns.findIndex((c) => c.name === col);
    return b.y + HEAD + (i < 0 ? 0 : i) * ROW + ROW / 2 + 2;
  };

  const edges = rels.map((r) => {
    const a = boxes.get(r.from)!, b = boxes.get(r.to)!;
    const y1 = rowY(r.from, r.fromColumn), y2 = rowY(r.to, r.toColumn);
    const leftward = b.x + b.w <= a.x;
    const x1 = leftward ? a.x : a.x + a.w, x2 = leftward ? b.x + b.w : b.x;
    const dir: 1 | -1 = leftward ? -1 : 1;
    const bend = Math.max(40, Math.abs(x2 - x1) / 2);
    const d = `M${x1},${y1} C${x1 + dir * bend},${y1} ${x2 - dir * bend},${y2} ${x2},${y2}`;
    const inner = `<path class="dg-line${r.optional ? " dg-optional" : ""}" d="${d}"/><path class="dg-hit" d="${d}"/>${endShape(r.fromEnd ?? "many", x1, y1, dir)}${endShape(r.toEnd ?? "exactly-one", x2, y2, dir === 1 ? -1 : 1)}`;
    return wrap({ cls: `dg-edge${r.id === input.selected ? " is-selected" : ""}`, edge: r.id, ends: [r.from, r.to], href: r.href, title: r.title ?? r.id }, inner);
  }).join("");

  const nodes = [...boxes.values()].map((b) => {
    const ent = ents.get(b.id)!;
    const rows = ent.columns.map((c, i) => {
      const y = b.y + HEAD + i * ROW + ROW / 2 + 6;
      const key = c.pk ? "PK" : c.fk ? "FK" : "";
      return `<text class="dg-key" x="${b.x + 10}" y="${y}">${key}</text><text class="dg-col${c.pk ? " dg-pk" : ""}" x="${b.x + 38}" y="${y}">${esc(c.name)}</text><text class="dg-sub" x="${b.x + b.w - 10}" y="${y}" text-anchor="end">${esc((c.type ?? "") + (c.nullable ? "?" : ""))}</text>`;
    }).join("");
    const inner = `<rect class="dg-box" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6"/><path class="dg-rule" d="M${b.x},${b.y + HEAD} h${b.w}"/>${title(b.x + 10, b.y + 20, b.id, "start")}${ent.tag ? tag(b.x + b.w - 10, b.y + 20, ent.tag, "end") : ""}${rows}`;
    const cls = `dg-node${ent.stub ? " dg-stub" : ""}${b.id === input.selected ? " is-selected" : ""}`;
    return wrap({ cls, node: b.id, href: ent.href, title: ent.title ?? b.id }, inner);
  }).join("");
  return diagramFrame({ kind: "erd", width: W, height: H, label: input.label ?? `Entity relationship diagram with ${input.entities.length} tables` },
    `<g class="dg-edges">${edges}</g><g class="dg-nodes">${nodes}</g>`);
}

// ── renderer: DFD ──────────────────────────────────────────────────────────────────────────────

export type DfdKind = "process" | "store" | "external";
export interface DfdNodeIn { id: string; kind: DfdKind; label: string; boundary?: string; href?: string; title?: string }
export interface DfdBoundaryIn { id: string; label: string; title?: string }
export interface DfdFlowIn { id: string; from: string; to: string; label?: string; emphasis?: boolean; href?: string; title?: string }
export interface DfdInput { nodes: DfdNodeIn[]; boundaries: DfdBoundaryIn[]; flows: DfdFlowIn[]; selected?: string; label?: string }

/** A column slot in the DFD: a trust boundary, or loose nodes on the left or right edge. */
type Slot = { boundary?: DfdBoundaryIn; side?: "left" | "right" };

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

/**
 * Where each DFD column goes. Boundaries stay contiguous, and their order is the one that keeps
 * flows short and, above all, keeps a flow from passing through a boundary it does not touch. Each
 * loose node (an external entity, mostly) then sits on whichever outer edge is nearer to what it
 * connects to. Up to six boundaries are tried exhaustively; past that, the given order stands.
 */
export function dfdColumns(input: DfdInput): { slots: Slot[]; side: Map<string, "left" | "right"> } {
  const known = new Set(input.boundaries.map((b) => b.id));
  const groupOf = (id: string) => { const n = input.nodes.find((x) => x.id === id); return n?.boundary && known.has(n.boundary) ? n.boundary : undefined; };
  const loose = input.nodes.filter((n) => !groupOf(n.id)).map((n) => n.id);
  const tries = input.boundaries.length <= 6 ? permutations(input.boundaries) : [input.boundaries];
  let best = { cost: Infinity, order: input.boundaries, side: new Map<string, "left" | "right">() };
  for (const order of tries) {
    const pos = new Map(order.map((b, i) => [b.id, i + 1]));
    const last = order.length + 1;
    const side = new Map<string, "left" | "right">();
    for (const id of loose) {
      const touches = input.flows.flatMap((f) => (f.from === id ? [f.to] : f.to === id ? [f.from] : [])).map((o) => pos.get(groupOf(o) ?? "")).filter((p): p is number => p !== undefined);
      const mean = touches.length ? touches.reduce((s, p) => s + p, 0) / touches.length : 0;
      side.set(id, touches.length && mean > last / 2 ? "right" : "left");
    }
    const at = (id: string) => pos.get(groupOf(id) ?? "") ?? (side.get(id) === "right" ? last : 0);
    let cost = 0;
    for (const f of input.flows) {
      const span = Math.abs(at(f.from) - at(f.to));
      cost += Math.max(0, span - 1) * 100 + span;
    }
    if (cost < best.cost) best = { cost, order, side };
  }
  const slots: Slot[] = [];
  if ([...best.side.values()].includes("left")) slots.push({ side: "left" });
  for (const b of best.order) slots.push({ boundary: b });
  if ([...best.side.values()].includes("right")) slots.push({ side: "right" });
  return { slots, side: best.side };
}

/** A Gane and Sarson DFD, with each trust boundary drawn as a dashed region around its members. */
export function dfdDiagram(input: DfdInput): string {
  const PAD = 28, GAPX = 150, GAPY = 30, NH = 54, BPAD = 22, BHEAD = 30, INNER = 90;
  const labels = new LabelPlacer();
  const widthOf = (n: DfdNodeIn) => textWidth(n.label, 150) + (n.kind === "store" ? 36 : 0);
  const { slots, side } = dfdColumns(input);
  const byId = new Map(input.nodes.map((n) => [n.id, n]));
  // Inside a boundary, processes and the rest form two columns, the processes facing the side
  // where more of their outside flows go, so a flow in from an external never crosses the stores.
  const columns: { slot: Slot; cols: string[][] }[] = slots.map((slot, si) => {
    if (!slot.boundary) return { slot, cols: [input.nodes.filter((n) => side.get(n.id) === slot.side).map((n) => n.id)] };
    const members = input.nodes.filter((n) => n.boundary === slot.boundary!.id);
    const procs = members.filter((n) => n.kind === "process").map((n) => n.id), rest = members.filter((n) => n.kind !== "process").map((n) => n.id);
    const slotOf = (id: string) => { const n = byId.get(id); const i = slots.findIndex((s) => (n?.boundary && s.boundary?.id === n.boundary) || (!s.boundary && side.get(id) === s.side)); return i; };
    let pull = 0;
    for (const f of input.flows) for (const [a, b] of [[f.from, f.to], [f.to, f.from]] as const) if (procs.includes(a)) { const o = slotOf(b); if (o !== si && o >= 0) pull += Math.sign(o - si); }
    const pair = pull > 0 ? [rest, procs] : [procs, rest];
    return { slot, cols: pair.filter((c) => c.length) };
  });
  // Vertical order within every column follows connection, across all columns left to right.
  const flat = columns.flatMap((c) => c.cols);
  const ordered = orderByConnection(flat, input.flows.map((f) => [f.from, f.to]));
  let k = 0;
  for (const c of columns) c.cols = c.cols.map(() => ordered[k++]!);

  const boxes = new Map<string, Box>();
  const regions: string[] = [];
  let x = PAD, H = 0;
  for (const group of columns) {
    const top = PAD + (group.slot.boundary ? BHEAD : 0);
    const startX = x + (group.slot.boundary ? BPAD : 0);
    let cx = startX, bottom = top;
    for (const col of group.cols) {
      const w = Math.max(...col.map((id) => widthOf(byId.get(id)!)));
      let y = top + (group.slot.boundary ? 6 : 0);
      for (const id of col) { const nw = widthOf(byId.get(id)!); boxes.set(id, { id, x: cx + (w - nw) / 2, y, w: nw, h: NH }); y += NH + GAPY; }
      bottom = Math.max(bottom, y - GAPY);
      cx += w + INNER;
    }
    const innerW = cx - INNER - startX;
    if (group.slot.boundary) {
      const b = group.slot.boundary, bw = innerW + BPAD * 2, bh = bottom - PAD + BPAD;
      regions.push(boundary({ id: b.id, x, y: PAD, w: bw, h: bh }, b.label, b.title ?? `Trust boundary: ${b.label}`));
      x += bw + GAPX; H = Math.max(H, PAD + bh);
    } else { x += innerW + GAPX; H = Math.max(H, bottom); }
  }
  const W = x - GAPX + PAD;
  labels.avoid(...boxes.values());
  const counter = { process: 0, store: 0, external: 0 };
  const nodes = input.nodes.filter((n) => boxes.has(n.id)).map((n) => {
    const b = boxes.get(n.id)!, i = ++counter[n.kind];
    const shape = n.kind === "process" ? ganeSarson.process(b, n.label, `P${i}`) : n.kind === "store" ? ganeSarson.store(b, n.label, `D${i}`) : ganeSarson.external(b, n.label);
    return wrap({ cls: `dg-node dg-dfd-${n.kind}${n.id === input.selected ? " is-selected" : ""}`, node: n.id, href: n.href, title: n.title ?? `${n.label} (${n.kind})` }, shape);
  }).join("");
  // Two flows between the same pair are spread apart so their labels do not sit on each other.
  const pairCount = new Map<string, number>();
  const flows = input.flows.filter((f) => boxes.has(f.from) && boxes.has(f.to)).map((f) => {
    const a = boxes.get(f.from)!, b = boxes.get(f.to)!;
    const key = [f.from, f.to].sort().join("|");
    const n = pairCount.get(key) ?? 0; pairCount.set(key, n + 1);
    const off = n * 16;
    const [ax, ay] = centre(a), [bx, by] = centre(b);
    const [x1, y1] = edgePoint(a, bx, by + off), [x2, y2] = edgePoint(b, ax, ay + off);
    labels.place((x1 + x2) / 2, (y1 + y2) / 2 + off, f.label ?? f.id);
    const cls = `dg-edge${f.emphasis ? " dg-emphasis" : ""}${f.id === input.selected ? " is-selected" : ""}`;
    return wrap({ cls, edge: f.id, ends: [f.from, f.to], href: f.href, title: f.title ?? f.label ?? f.id }, arrow([x1, y1 + off], [x2, y2 + off]));
  }).join("");
  return diagramFrame({ kind: "dfd", width: W, height: H + PAD, label: input.label ?? `Data flow diagram with ${input.flows.length} flows` },
    `<g class="dg-regions">${regions.join("")}</g><g class="dg-edges">${flows}</g><g class="dg-nodes">${nodes}</g>${labels.svg()}`);
}

// ── renderer: layered box diagrams (C4 and flowcharts) ─────────────────────────────────────────

export type LayeredKind =
  | "person" | "system" | "container" | "external"
  | "start" | "action" | "decision" | "flow-system" | "end";
export interface LayeredNodeIn { id: string; kind: LayeredKind; label: string; sub?: string; href?: string; title?: string; selected?: boolean }
export interface LayeredEdgeIn { from: string; to: string; label?: string; id?: string; href?: string; title?: string }
export interface LayeredInput {
  kind: string; nodes: LayeredNodeIn[]; edges: LayeredEdgeIn[]; label: string;
  /** A dashed scope drawn around some nodes, such as the system boundary on a C4 container view. */
  group?: { label: string; members: string[] };
  /** The narrowest a node may be. */
  minWidth?: number;
}

const SHAPES: Record<LayeredKind, (b: Box, label: string, second?: string) => string> = {
  person: c4.person, system: c4.system, container: c4.container, external: c4.external,
  start: flowchart.start, action: flowchart.action, decision: flowchart.decision, "flow-system": flowchart.system, end: flowchart.end,
};

/** A top-down layered diagram: rows by longest path, order within a row by connection. */
export function layeredDiagram(input: LayeredInput): string {
  const PAD = 30, GAPX = 60, GAPY = 96;
  const labels = new LabelPlacer();
  const byId = new Map(input.nodes.map((n) => [n.id, n]));
  const sizeOf = (n: LayeredNodeIn) => {
    const w = Math.max(textWidth(n.label, input.minWidth ?? 180), n.sub ? textWidth(n.sub) - 10 : 0);
    if (n.kind === "decision") return { w: w + 40, h: 76 };
    if (n.kind === "person") return { w, h: 84 };
    return { w, h: n.sub ? 62 : 48 };
  };
  const pairs: [string, string][] = input.edges.map((x) => [x.from, x.to]);
  const rows = orderByConnection(layers(input.nodes.map((n) => n.id), pairs), pairs);
  const rowW = rows.map((r) => r.reduce((s, id) => s + sizeOf(byId.get(id)!).w, 0) + (r.length - 1) * GAPX);
  const W = Math.max(...rowW) + PAD * 2 + (input.group ? 40 : 0);
  const boxes = new Map<string, Box>();
  let y = PAD + (input.group ? 30 : 0);
  rows.forEach((r, i) => {
    let x = (W - rowW[i]!) / 2;
    const h = Math.max(...r.map((id) => sizeOf(byId.get(id)!).h));
    for (const id of r) { const s = sizeOf(byId.get(id)!); boxes.set(id, { id, x, y: y + (h - s.h) / 2, w: s.w, h: s.h }); x += s.w + GAPX; }
    y += h + GAPY;
  });
  const H = y - GAPY + PAD;
  let scope = "";
  if (input.group) {
    const mem = input.group.members.map((id) => boxes.get(id)).filter((b): b is Box => !!b);
    if (mem.length) {
      const x0 = Math.min(...mem.map((b) => b.x)) - 24, y0 = Math.min(...mem.map((b) => b.y)) - 34;
      const x1 = Math.max(...mem.map((b) => b.x + b.w)) + 24, y1 = Math.max(...mem.map((b) => b.y + b.h)) + 20;
      scope = boundary({ id: "scope", x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, input.group.label);
    }
  }
  labels.avoid(...boxes.values());
  const edgeEls = input.edges.filter((x) => boxes.has(x.from) && boxes.has(x.to)).map((x) => {
    const a = boxes.get(x.from)!, b = boxes.get(x.to)!;
    const [ax, ay] = centre(a), [bx, by] = centre(b);
    const sa = byId.get(x.from)!.kind === "decision" ? "diamond" : "rect", sb = byId.get(x.to)!.kind === "decision" ? "diamond" : "rect";
    const p1 = edgePoint(a, bx, by, sa), p2 = edgePoint(b, ax, ay, sb);
    labels.place((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, x.label ?? "");
    const id = x.id ?? `${x.from}-${x.to}`;
    return wrap({ cls: "dg-edge", edge: id, ends: [x.from, x.to], href: x.href, title: x.title ?? x.label ?? id }, arrow(p1, p2));
  }).join("");
  const nodeEls = input.nodes.map((n) => {
    const b = boxes.get(n.id)!;
    return wrap({ cls: `dg-node dg-k-${n.kind}${n.selected ? " is-selected" : ""}`, node: n.id, href: n.href, title: n.title ?? n.label }, SHAPES[n.kind](b, n.label, n.sub));
  }).join("");
  return diagramFrame({ kind: input.kind, width: W, height: H, label: input.label }, `${scope}<g class="dg-edges">${edgeEls}</g><g class="dg-nodes">${nodeEls}</g>${labels.svg()}`);
}

// ── behaviour: pan, zoom and hover tracing ─────────────────────────────────────────────────────

/** The browser half, as a script tag a page includes once. It wires every .diagram on the page. */
export const DIAGRAM_SCRIPT = `<script>
(() => {
  for (const fig of document.querySelectorAll(".diagram")) {
    const svg = fig.querySelector("svg.diagram__svg"); if (!svg || svg.dataset.wired) continue;
    svg.dataset.wired = "1";
    const W = +svg.dataset.w, H = +svg.dataset.h;
    let vb = [0, 0, W, H];
    const set = () => svg.setAttribute("viewBox", vb.map((n) => n.toFixed(1)).join(" "));
    const zoom = (k, cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2) => {
      const w = Math.min(W * 4, Math.max(W / 8, vb[2] * k)), h = w * (vb[3] / vb[2]);
      vb = [cx - (cx - vb[0]) * (w / vb[2]), cy - (cy - vb[1]) * (h / vb[3]), w, h]; set();
    };
    const pt = (ev) => { const r = svg.getBoundingClientRect(); return [vb[0] + (ev.clientX - r.left) / r.width * vb[2], vb[1] + (ev.clientY - r.top) / r.height * vb[3]]; };
    fig.querySelectorAll("[data-zoom]").forEach((b) => b.addEventListener("click", () => {
      const z = b.dataset.zoom; if (z === "reset") { vb = [0, 0, W, H]; set(); } else zoom(z === "in" ? 0.8 : 1.25);
    }));
    // A plain wheel scrolls the page; only Ctrl (or Cmd) and the wheel zoom. A trackpad pinch arrives as a
    // wheel with ctrlKey set, so pinch still zooms. Taking every wheel turned the page into a trap: a reader
    // scrolling past a diagram got stuck zooming it instead.
    svg.addEventListener("wheel", (ev) => { if (!ev.ctrlKey && !ev.metaKey) return; ev.preventDefault(); const [x, y] = pt(ev); zoom(ev.deltaY < 0 ? 0.88 : 1.14, x, y); }, { passive: false });
    let drag = null, moved = false;
    svg.addEventListener("pointerdown", (ev) => { drag = [ev.clientX, ev.clientY, vb[0], vb[1]]; moved = false; });
    addEventListener("pointermove", (ev) => {
      if (!drag) return;
      const r = svg.getBoundingClientRect(), dx = ev.clientX - drag[0], dy = ev.clientY - drag[1];
      if (Math.abs(dx) + Math.abs(dy) > 4) { moved = true; svg.classList.add("is-panning"); }
      if (moved) { vb[0] = drag[2] - dx / r.width * vb[2]; vb[1] = drag[3] - dy / r.height * vb[3]; set(); }
    });
    addEventListener("pointerup", () => { drag = null; svg.classList.remove("is-panning"); });
    svg.addEventListener("click", (ev) => { if (moved) { ev.preventDefault(); ev.stopPropagation(); moved = false; } }, true);
    // Hover a node to trace everything it touches; hover an edge to trace its two ends.
    const edges = [...svg.querySelectorAll("[data-edge]")];
    const ends = (x) => x.dataset.ends.split(" ");
    const trace = (nodeIds, lit) => {
      svg.classList.add("is-tracing");
      svg.querySelectorAll("[data-node]").forEach((n) => n.classList.toggle("is-lit", nodeIds.has(n.dataset.node)));
      edges.forEach((x) => x.classList.toggle("is-lit", lit.includes(x)));
    };
    const clear = () => { svg.classList.remove("is-tracing"); svg.querySelectorAll(".is-lit").forEach((n) => n.classList.remove("is-lit")); };
    svg.querySelectorAll(".dg-nodes [data-node]").forEach((n) => {
      n.addEventListener("mouseenter", () => {
        const id = n.dataset.node, touching = edges.filter((x) => ends(x).includes(id));
        trace(new Set([id, ...touching.flatMap(ends)]), touching);
      });
      n.addEventListener("mouseleave", clear);
    });
    edges.forEach((x) => { x.addEventListener("mouseenter", () => trace(new Set(ends(x)), [x])); x.addEventListener("mouseleave", clear); });
  }
})();
</script>`;

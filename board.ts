// proof/board.ts — the board view: LoadedPlans → HTML, emitting FINAL HTML with GRAIN CSS
// classes (`.card`, `.badge`, `.masthead`), never data-bound `<b-…>` tags. This is MILL's
// hard-won rule (a component tag's children get replaced by its template) and it also keeps the
// board a pure string builder with no renderer/compose dependency — trivially testable. The only
// thing that DOES go through a renderer is the card-detail body (MILL, in serve.ts).
import { escapeHtml } from "../mill/core/engine.ts";
import { STATUSES, type PlanStatus } from "./core/types.ts";
import type { LoadedPlan } from "./loader.ts";

// Column headings — the four lifecycle states, left→right. Kept beside STATUSES (the SSOT) so a
// new status is a one-line add here, and the type below fails the build until this is updated.
const COLUMN_LABEL: Record<PlanStatus, string> = {
  todo: "To do",
  doing: "Doing",
  done: "Done",
  blocked: "Blocked",
};

const OWNER_MARK: Record<"ai" | "human", string> = { ai: "AI", human: "Human" };

const shortDate = (iso: string | null): string => (iso ? iso.slice(0, 10) : "");

function card(lp: LoadedPlan): string {
  const p = lp.plan;
  const total = p.tasks.length;
  const done = p.tasks.filter((t) => t.done).length;
  const progress = total > 0 ? `${done}/${total} tasks` : "";
  const age = shortDate(lp.lastModified);
  const meta = [p.track ? `Track ${p.track}` : "", progress, age].filter(Boolean).join(" · ");

  const touches = p.touches.length
    ? `<ul class="proof-card__touches">${p.touches
        .map((t) => `<li class="proof-card__chip">${escapeHtml(t)}</li>`)
        .join("")}</ul>`
    : "";

  // A parse problem is surfaced on the card, not hidden — the board is also the lint's window.
  const flag = lp.errors.length
    ? `<p class="proof-card__flag" title="${escapeHtml(lp.errors.map((e) => `${e.field}: ${e.message}`).join("\n"))}">⚠ ${lp.errors.length} issue${lp.errors.length > 1 ? "s" : ""}</p>`
    : "";

  return `<a class="card proof-card" data-pad="sm" href="/plan/${escapeHtml(p.id)}">
  <div class="proof-card__top">
    <span class="badge" data-status="${escapeHtml(p.status)}">${escapeHtml(p.status)}</span>
    <span class="proof-card__owner" data-owner="${escapeHtml(p.owner)}">${OWNER_MARK[p.owner]}</span>
  </div>
  <h3 class="card__title">${escapeHtml(p.title)}</h3>
  ${meta ? `<p class="proof-card__meta">${escapeHtml(meta)}</p>` : ""}
  ${touches}
  ${flag}
</a>`;
}

function column(status: PlanStatus, plans: LoadedPlan[]): string {
  const cards = plans.map(card).join("\n");
  return `<section class="proof-col" data-status="${status}">
  <header class="proof-col__head"><h2 class="proof-col__title">${COLUMN_LABEL[status]}</h2><span class="proof-col__count">${plans.length}</span></header>
  <div class="proof-col__cards">${cards || `<p class="proof-col__empty">—</p>`}</div>
</section>`;
}

// The board body: one column per status, plans sorted by id within a column (stable, the id
// carries the intended order, e.g. `001-…`, `002-…`).
export function renderBoard(plans: LoadedPlan[]): string {
  const byStatus = (s: PlanStatus) =>
    plans.filter((lp) => lp.plan.status === s).sort((a, b) => a.plan.id.localeCompare(b.plan.id));
  const cols = STATUSES.map((s) => column(s, byStatus(s))).join("\n");
  return `<div class="proof-board">${cols}</div>`;
}

// The full board BODY: masthead + lede + duplicate-id flag + the board itself, wrapped in the
// `proof-board` surface. This is the ONE place that HTML is built — the standalone route
// (routes.ts) and the live watcher (live.ts, piece 3) both call this so a pushed SSE `replace`
// is byte-identical to a fresh page load. `data-surface="proof-board"` is the replace target: the
// live client (board-live.js) swaps this div's innerHTML wholesale on every plans/ change.
export function renderBoardBody(plans: LoadedPlan[], duplicates: string[]): string {
  const dupNote = duplicates.length
    ? `<p class="proof-card__flag">⚠ duplicate plan id(s): ${escapeHtml(duplicates.join(", "))}</p>`
    : "";
  return `<div data-surface="proof-board">
<header>
  <h1 class="proof-masthead">Plans</h1>
  <p class="proof-lede">${plans.length} plan${plans.length === 1 ? "" : "s"}. The files are the source of truth; this board is a window.</p>
  ${dupNote}
</header>
${renderBoard(plans)}
</div>`;
}

// The card-detail header (shown above the MILL-rendered body): the frontmatter facts a plan file
// carries, laid out plainly. The body itself is rendered by MILL in serve.ts.
export function renderPlanHeader(lp: LoadedPlan): string {
  const p = lp.plan;
  const facts = [
    ["Status", p.status],
    ["Owner", OWNER_MARK[p.owner]],
    p.track ? ["Track", p.track] : null,
    p.depends.length ? ["Depends on", p.depends.join(", ")] : null,
    p.touches.length ? ["Touches", p.touches.join(", ")] : null,
    lp.lastModified ? ["Updated", shortDate(lp.lastModified)] : null,
  ].filter((x): x is [string, string] => x !== null);
  const rows = facts
    .map(([k, v]) => `<div class="proof-facts__row"><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`)
    .join("");
  return `<dl class="proof-facts">${rows}</dl>`;
}

// Page chrome — links the GRAIN page stylesheets (tokens → base → grade) + the component bundle
// + the board's own layout CSS. `stylesheets` is injected by the server (it owns the URLs).
export function boardPage(title: string, body: string, stylesheets: string[]): string {
  const links = stylesheets.map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}">`).join("\n  ");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  ${links}
</head>
<body class="proof-body" data-grade="smooth">
  <main class="proof-main">${body}</main>
</body>
</html>`;
}

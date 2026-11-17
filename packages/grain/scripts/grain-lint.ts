#!/usr/bin/env bun
// grain-lint.ts: check a GRAIN page for the tells of machine-made design.
//
//   bun grain-lint.ts <url|file.html> [more...]     rendered: Playwright at 360, 768 and 1280
//   bun grain-lint.ts --static <file|dir> [more...] static: source text only, no browser, < 1s
//   flags: --json  --rule <id> (repeatable)  --widths 360,768,1280
//
// Exit 1 on any floor finding, or a reflex finding without a data-grain-lint-allow reason.
// Finish findings report and never block. The rules live in grain-lint-rules.ts.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { RULES, PAGE_HELPERS, allowReason, type Rule, type Tier, type StaticSource, type Hit } from "./grain-lint-rules.ts";

export interface Finding {
  rule: string;
  tier: Tier;
  target: string;
  selector: string;
  detail: string;
  fix: string;
  widths?: number[];
  line?: number;
  /** The reason from data-grain-lint-allow, when one excuses a reflex finding. */
  allowed?: string;
}

export interface LintOptions { rules?: string[]; widths?: number[] }

export const DEFAULT_WIDTHS = [360, 768, 1280];

const pick = (ids?: string[]): Rule[] => ids?.length ? RULES.filter(r => ids.includes(r.id)) : RULES;

function toFinding(rule: Rule, target: string, hit: Hit, width?: number): Finding {
  const allowed = rule.tier === "reflex" ? allowReason(hit.allow, rule.id) : undefined;
  return {
    rule: rule.id, tier: rule.tier, target, selector: hit.selector, detail: hit.detail, fix: rule.fix,
    ...(width ? { widths: [width] } : {}), ...(hit.line ? { line: hit.line } : {}), ...(allowed ? { allowed } : {}),
  };
}

/** A finding blocks when it is floor, or reflex with no recorded reason. */
export const blocks = (f: Finding): boolean => f.tier === "floor" || (f.tier === "reflex" && !f.allowed);

// ---- static mode ------------------------------------------------------------------------------

export function lintSource(src: StaticSource, opts: LintOptions = {}): Finding[] {
  const out: Finding[] = [];
  for (const rule of pick(opts.rules)) {
    if (!rule.static) continue;
    for (const hit of rule.static(src)) out.push(toFinding(rule, src.path, hit));
  }
  return out;
}

function collect(path: string, into: string[] = []): string[] {
  if (statSync(path).isDirectory()) {
    for (const name of readdirSync(path)) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      collect(join(path, name), into);
    }
  } else if ([".html", ".css"].includes(extname(path))) into.push(path);
  return into;
}

export function lintStatic(paths: string[], opts: LintOptions = {}): Finding[] {
  const files = paths.flatMap(p => collect(resolve(p)));
  return files.flatMap(path =>
    lintSource({ path, text: readFileSync(path, "utf8"), kind: extname(path) === ".css" ? "css" : "html" }, opts));
}

// ---- rendered mode ----------------------------------------------------------------------------

/** axe-core's source, when the consumer carries it (the portfolio does), for contrast and focus. */
function axeSource(): string | undefined {
  try { return readFileSync(Bun.resolveSync("axe-core/axe.min.js", process.cwd()), "utf8"); } catch { return undefined; }
}

/** The page surface the rendered mode needs; Playwright's Page satisfies it. */
export interface LintPage {
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  goto(url: string, opts?: { waitUntil?: "load" | "networkidle" }): Promise<unknown>;
  evaluate<R, A>(fn: (arg: A) => R, arg: A): Promise<R>;
  evaluate<R>(script: string): Promise<R>;
}

export async function lintPage(page: LintPage, url: string, opts: LintOptions = {}): Promise<Finding[]> {
  const rules = pick(opts.rules).filter(r => r.rendered);
  const axe = rules.some(r => r.id === "contrast-aa") ? axeSource() : undefined;
  const byKey = new Map<string, Finding>();
  for (const width of opts.widths ?? DEFAULT_WIDTHS) {
    await page.setViewportSize({ width, height: width < 700 ? 780 : 800 });
    await page.goto(url, { waitUntil: "load" });
    await page.evaluate("document.fonts ? document.fonts.ready.then(() => true) : true");
    await page.evaluate(PAGE_HELPERS);
    for (const rule of rules) {
      let hits: Hit[];
      if (rule.id === "contrast-aa" && axe) hits = await axeContrast(page, axe);
      else hits = await page.evaluate(new Function("w", `return (${rule.rendered!.toString()})(w)`) as (w: number) => Hit[], width);
      for (const hit of hits) {
        const key = `${rule.id}|${hit.selector}`;
        const seen = byKey.get(key);
        if (seen) { if (!seen.widths!.includes(width)) seen.widths!.push(width); continue; }
        byKey.set(key, toFinding(rule, url, hit, width));
      }
    }
  }
  return [...byKey.values()];
}

/** Reuse axe's color-contrast run rather than writing the rule twice, when axe is installed. */
async function axeContrast(page: LintPage, axe: string): Promise<Hit[]> {
  await page.evaluate(axe);
  return page.evaluate(`axe.run(document, { runOnly: ["color-contrast"], resultTypes: ["violations"] }).then(r =>
    r.violations.flatMap(v => v.nodes.map(n => {
      const el = document.querySelector(n.target[0]);
      return { selector: String(n.target[0]), detail: n.failureSummary.split("\\n").pop().trim(), allow: el ? window.__gl.allow(el) : undefined };
    })))`);
}

export async function lintUrls(targets: string[], opts: LintOptions = {}): Promise<Finding[]> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    const out: Finding[] = [];
    for (const t of targets) {
      const url = /^https?:|^file:/.test(t) ? t : pathToFileURL(resolve(t)).href;
      out.push(...await lintPage(page as unknown as LintPage, url, opts));
    }
    return out;
  } finally { await browser.close(); }
}

// ---- report -----------------------------------------------------------------------------------

const TIER_ORDER: Tier[] = ["floor", "reflex", "finish"];

export function format(findings: Finding[]): string {
  const lines: string[] = [];
  for (const tier of TIER_ORDER) {
    const group = findings.filter(f => f.tier === tier);
    if (!group.length) continue;
    const verb = tier === "finish" ? "reports" : "blocks";
    lines.push(`${tier.toUpperCase()} (${group.length}, ${verb})`);
    for (const f of group) {
      const where = f.line ? `${f.target}:${f.line}` : f.target;
      const at = f.widths ? ` @${f.widths.join(",")}` : "";
      const mark = f.allowed ? "  allowed" : "";
      lines.push(`  ${f.rule}  ${f.selector}${at}${mark}`);
      lines.push(`    ${f.detail}  (${where})`);
      lines.push(f.allowed ? `    reason: ${f.allowed}` : `    fix: ${f.fix}`);
    }
  }
  const blocking = findings.filter(blocks).length;
  lines.push(blocking ? `grain-lint: ${blocking} blocking finding(s)` : `grain-lint: clean (${findings.length} non-blocking)`);
  return lines.join("\n");
}

// ---- CLI --------------------------------------------------------------------------------------

if (import.meta.main) {
  const args = process.argv.slice(2);
  const flag = (name: string) => { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true; };
  const values = (name: string) => { const out: string[] = []; let i; while ((i = args.indexOf(name)) >= 0) { out.push(args[i + 1]!); args.splice(i, 2); } return out; };
  const json = flag("--json"), isStatic = flag("--static");
  const rules = values("--rule");
  const widths = values("--widths").flatMap(w => w.split(",").map(Number));
  if (!args.length) { console.error("usage: grain-lint [--static] [--json] [--rule id] <url|file|dir>..."); process.exit(2); }
  const unknown = rules.filter(r => !RULES.some(x => x.id === r));
  if (unknown.length) { console.error(`unknown rule: ${unknown.join(", ")}`); process.exit(2); }
  const opts = { rules, ...(widths.length ? { widths } : {}) };
  const missing = args.filter(a => !/^https?:|^file:/.test(a) && !existsSync(a));
  if (missing.length) { console.error(`not found: ${missing.join(", ")}`); process.exit(2); }
  const findings = isStatic ? lintStatic(args, opts) : await lintUrls(args, opts);
  console.log(json ? JSON.stringify(findings, null, 2) : format(findings));
  process.exit(findings.some(blocks) ? 1 : 0);
}

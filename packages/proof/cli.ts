#!/usr/bin/env bun
// proof/cli.ts — the command line for the PROOF layer:
//   proof serve [dir] [--port N]   boot the standalone board (a viewer of last resort; a BATCH
//                                  host like PANTRY mounts createProofRoutes instead)
//   proof check [dir]              lint the plans folder (CI-able; exits nonzero on an error)
//   proof init  [dir]             scaffold PROOF into a project (plans/ + contract + hooks)
// `dir` defaults to ./plans (serve/check) or . (init), relative to the caller's cwd. Assets
// resolve relative to this module, so the tool runs from any project via `bunx proof`.
import { isAbsolute, join } from "node:path";
import { serveProof } from "./serve.ts";
import { runCheck, formatReport } from "./check.ts";
import { runInit } from "./init.ts";

const abs = (dir: string) => (isAbsolute(dir) ? dir : join(process.cwd(), dir));

interface Args { cmd: string; dir: string | null; port: number; force: boolean }

function parseArgs(argv: string[]): Args {
  const [cmd = "serve", ...rest] = argv;
  let dir: string | null = null;
  let port = 4321;
  let force = false;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--port" || a === "-p") { port = Number(rest[++i]); continue; }
    if (a.startsWith("--port=")) { port = Number(a.slice("--port=".length)); continue; }
    if (a === "--force" || a === "-f") { force = true; continue; }
    if (!a.startsWith("-")) dir = a;
  }
  return { cmd, dir, port, force };
}

async function main() {
  const { cmd, dir, port, force } = parseArgs(Bun.argv.slice(2));

  if (cmd === "serve") {
    const plansDir = abs(dir ?? "plans");
    const { server } = serveProof({ plansDir, port });
    console.log(`PROOF board on ${server.url} — reading plans from ${plansDir}`);
    console.log("The files are the source of truth; this board is a window. Ctrl-C to stop.");
    return;
  }

  if (cmd === "check") {
    const plansDir = abs(dir ?? "plans");
    const report = await runCheck(plansDir);
    console.log(formatReport(report));
    process.exit(report.ok ? 0 : 1);   // nonzero on an error → fails CI
  }

  if (cmd === "init") {
    const targetDir = abs(dir ?? ".");
    const result = await runInit(targetDir, { force });
    for (const f of result.created) console.log(`  created  ${f}`);
    for (const f of result.skipped) console.log(`  skipped  ${f} (exists; --force to overwrite)`);
    console.log(`\n${result.instructions}`);
    return;
  }

  console.error(`proof: unknown command "${cmd}"\nusage: proof <serve|check|init> [dir] [--port N] [--force]`);
  process.exit(1);
}

void main();

#!/usr/bin/env bun
// proof/cli.ts — the command line: `proof serve [dir] [--port N]`.
// `dir` is the consumer's plans folder (default ./plans, relative to THEIR cwd). Assets resolve
// relative to this module, so the tool runs from any project via `bunx proof serve`.
import { isAbsolute, join } from "node:path";
import { serveProof } from "./serve.ts";

function parseArgs(argv: string[]): { cmd: string; dir: string; port: number } {
  const [cmd = "serve", ...rest] = argv;
  let dir = "plans";
  let port = 4321;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--port" || a === "-p") { port = Number(rest[++i]); continue; }
    if (a.startsWith("--port=")) { port = Number(a.slice("--port=".length)); continue; }
    if (!a.startsWith("-")) dir = a;
  }
  return { cmd, dir, port };
}

function main() {
  const { cmd, dir, port } = parseArgs(Bun.argv.slice(2));

  if (cmd === "serve") {
    const plansDir = isAbsolute(dir) ? dir : join(process.cwd(), dir);
    const server = serveProof({ plansDir, port });
    console.log(`PROOF board on ${server.url} — reading plans from ${plansDir}`);
    console.log("The files are the source of truth; this board is a window. Ctrl-C to stop.");
    return;
  }

  console.error(`proof: unknown command "${cmd}"\nusage: proof serve [dir] [--port N]`);
  process.exit(1);
}

main();

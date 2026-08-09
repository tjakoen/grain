#!/usr/bin/env bun
// grain-mcp/cli.ts — the bin. The ONLY module in this package that touches a filesystem or a stream:
// every other file (jsonrpc.ts, harvest.ts, tools.ts, server.ts) is pure, so everything this file does
// is "read the export once, then shuttle lines between stdin and handleLine" — no logic of its own.
//
// Usage: `grain-mcp [export-dir]` (default "./dist"). Reads every *.html under export-dir into
// memory ONCE at startup (a personal static export is small; there's no live-reload story here — restart
// the process after a re-export, same as any other MCP stdio server a client spawns fresh per session).
//
// MCP stdio contract (why stdout/stderr are used the way they are, restated where it bites): one
// JSON-RPC message per LINE on stdout, and stdout carries ONLY those response lines — any diagnostic
// (startup summary, a caught crash) goes to stderr, because a client is line-parsing stdout and a
// stray "Loaded 79 pages" would be fed to its JSON parser as gospel.
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import { createServerState, handleLine, SERVER_NAME, SERVER_VERSION } from "./server.ts";
import { loadExport } from "./tools.ts";
import { toLine } from "./jsonrpc.ts";

async function walkHtmlFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name.endsWith(".html")) out.push(full);
    }
  }
  await walk(dir);
  return out;
}

async function loadExportDir(dir: string): Promise<Record<string, string>> {
  const absolute = resolve(dir);
  const htmlPaths = await walkHtmlFiles(absolute);
  const files: Record<string, string> = {};
  for (const path of htmlPaths) {
    const relPath = relative(absolute, path).split("\\").join("/");   // posix-shaped, cross-platform
    files[relPath] = await readFile(path, "utf8");
  }
  return files;
}

async function main(): Promise<void> {
  const dirArg = process.argv[2] ?? "./dist";

  let files: Record<string, string>;
  try {
    files = await loadExportDir(dirArg);
  } catch (e) {
    process.stderr.write(`${SERVER_NAME}: couldn't read export dir ${JSON.stringify(dirArg)}: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
  if (Object.keys(files).length === 0) {
    process.stderr.write(`${SERVER_NAME}: no .html files found under ${JSON.stringify(resolve(dirArg))} — is this a built export?\n`);
  }

  const exp = loadExport(files);
  const state = createServerState(exp);
  process.stderr.write(`${SERVER_NAME} v${SERVER_VERSION}: serving ${exp.pages.length} page(s) from ${JSON.stringify(resolve(dirArg))} over stdio\n`);

  const rl = createInterface({ input: process.stdin, terminal: false });

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;   // a blank keep-alive line some clients send — nothing to answer
    let response;
    try {
      response = handleLine(state, trimmed);
    } catch (e) {
      // A bug in this server, not a bad client message — there's no request id to answer against
      // reliably here (handleLine already turns parse/dispatch failures into a proper response; this
      // catch only fires if a handler itself threw somewhere handleLine didn't expect), so it's
      // reported to stderr rather than invented as a JSON-RPC line that might not even have a real id.
      process.stderr.write(`${SERVER_NAME}: unhandled error handling a line: ${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
      return;
    }
    if (response) process.stdout.write(toLine(response) + "\n");
  });

  // Signal-clean exit: stdin closing (the client disconnected / piped EOF) or a term signal both end
  // the process the same way a well-behaved stdio server should — no dangling handles, no non-zero
  // exit for an ordinary disconnect.
  const shutdown = () => process.exit(0);
  rl.on("close", shutdown);
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  process.stderr.write(`grain-mcp: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});

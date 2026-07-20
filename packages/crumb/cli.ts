// crumb/cli.ts — the CRUMB command line. `crumb check [dir]` lints a tours/ folder (the piece
// consumers wire as `bunx crumb check`). `serve`/`init` are later pieces (PLAN.md B2/B5).
import { checkDir } from "./check.ts";

const [cmd, dir = "tours"] = process.argv.slice(2);

if (cmd === "check") {
  const { ok, lines } = await checkDir(dir);
  for (const line of lines) console.log(line);
  process.exit(ok ? 0 : 1);
} else {
  console.log("crumb — the GRAIN stack's guided-tour / AI-review layer\n\nusage:\n  crumb check [dir]   lint a tours/ folder (default: ./tours)\n\n(serve / init are later pieces — see PLAN.md)");
  process.exit(cmd ? 1 : 0);
}

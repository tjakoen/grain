// proof/live.test.ts — the piece-3 file watcher: a plans/ change → ONE debounced broadcast of the
// fresh board body. A fake BoardChannel stands in for batch's Stream (structural port, no import).
import { test, expect } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OP_EVENT } from "@tjakoen/grain/ai/contract.ts";
import { watchPlans } from "./live.ts";

const noAge = async () => null;

function fakeChannel() {
  const broadcasts: Array<{ event: string; data: unknown }> = [];
  return { broadcasts, broadcast: (event: string, data: unknown) => broadcasts.push({ event, data }) };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("a plan file change triggers one debounced broadcast of the fresh board", async () => {
  const dir = await mkdtemp(join(tmpdir(), "proof-live-"));
  try {
    await writeFile(join(dir, "001-first.md"), "---\nstatus: todo\nowner: ai\n---\n# First plan\n", "utf8");

    const channel = fakeChannel();
    const watcher = watchPlans({ plansDir: dir, channel, lastModified: noAge });
    try {
      await wait(50);   // let the watcher settle before writing

      // a burst of writes should still collapse into ONE broadcast (the debounce)
      await writeFile(join(dir, "002-second.md"), "---\nstatus: doing\nowner: human\n---\n# Second plan\n", "utf8");
      await writeFile(join(dir, "002-second.md"), "---\nstatus: doing\nowner: human\n---\n# Second plan!\n", "utf8");

      await wait(400);   // past the 100ms debounce, generous for CI

      expect(channel.broadcasts.length).toBe(1);
      const [{ event, data }] = channel.broadcasts;
      expect(event).toBe(OP_EVENT);
      const op = data as { op: string; target: string; html: string };
      expect(op.op).toBe("replace");
      expect(op.target).toBe("proof-board");
      expect(op.html).toContain("Second plan");
      expect(op.html).toContain('data-surface="proof-board"');
    } finally {
      watcher.stop();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

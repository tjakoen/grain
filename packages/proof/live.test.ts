// PROOF watcher tests await observable work and shutdown before removing their fixtures.
import { test, expect } from "bun:test";
import { watch } from "node:fs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OP_EVENT } from "@tjakoen/grain/ai/contract.ts";
import { watchPlans } from "./live.ts";

const noAge = async () => null;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
async function within<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([promise, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error("watcher did not reach the expected state")), 3000);
    })]);
  } finally { clearTimeout(timer!); }
}
async function fixture(run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "proof-live-"));
  try {
    await writeFile(join(dir, "first.md"), "---\nstatus: todo\nowner: ai\n---\n# First plan\n");
    await run(dir);
  } finally { await rm(dir, { recursive: true, force: true }); }
}
function manualWatch() {
  let change = () => {};
  let closed = false;
  return {
    watch: (_dir: string, onChange: () => void) => { change = onChange; return { close: () => { closed = true; } }; },
    change: () => change(),
    closed: () => closed,
  };
}

test("a real plan change broadcasts the new board before shutdown", async () => {
  await fixture(async (dir) => {
    const received = deferred<{ event: string; data: unknown }>();
    const watcher = watchPlans({ plansDir: dir, lastModified: noAge,
      watch: (path, change) => watch(path, change),
      channel: { broadcast: (event, data) => received.resolve({ event, data }) } });
    try {
      await writeFile(join(dir, "second.md"), "---\nstatus: doing\nowner: human\n---\n# Second plan\n");
      const { event, data } = await within(received.promise);
      expect(event).toBe(OP_EVENT);
      expect(data).toMatchObject({ op: "replace", target: "proof-board" });
      expect((data as { html: string }).html).toContain("Second plan");
    } finally { await watcher.stop(); }
  });
});

test("shutdown drains an active rebuild and suppresses its broadcast", async () => {
  await fixture(async (dir) => {
    const started = deferred<void>(), release = deferred<string | null>();
    const manual = manualWatch();
    const ops: unknown[] = [];
    const watcher = watchPlans({ plansDir: dir, watch: manual.watch,
      lastModified: () => { started.resolve(); return release.promise; },
      channel: { broadcast: (_event, data) => ops.push(data) } });
    manual.change();
    await within(started.promise);
    let stopped = false;
    const shutdown = Promise.resolve(watcher.stop()).then(() => { stopped = true; });
    await Promise.resolve();
    expect(stopped).toBe(false);
    expect(manual.closed()).toBe(true);
    release.resolve(null);
    await within(shutdown);
    expect(ops).toEqual([]);
  });
});

test("a failed rebuild is reported and the watcher can recover", async () => {
  await fixture(async (dir) => {
    const manual = manualWatch(), failed = deferred<unknown>(), received = deferred<unknown>();
    let fail = true;
    const watcher = watchPlans({ plansDir: dir, watch: manual.watch,
      lastModified: async () => { if (fail) throw new Error("read failed"); return null; },
      onError: error => failed.resolve(error),
      channel: { broadcast: (_event, data) => received.resolve(data) } });
    try {
      manual.change();
      expect(String(await within(failed.promise))).toContain("read failed");
      fail = false;
      manual.change();
      expect(await within(received.promise)).toMatchObject({ target: "proof-board" });
    } finally { await watcher.stop(); }
  });
});

test("a burst is debounced and a change during a rebuild schedules one serialized refresh", async () => {
  await fixture(async (dir) => {
    const manual = manualWatch(), started = deferred<void>(), release = deferred<string | null>();
    const received = deferred<void>();
    let reads = 0, active = 0, maxActive = 0, broadcasts = 0;
    const watcher = watchPlans({ plansDir: dir, watch: manual.watch,
      lastModified: async () => {
        active++; maxActive = Math.max(maxActive, active); reads++;
        if (reads === 1) { started.resolve(); await release.promise; }
        active--; return null;
      },
      channel: { broadcast: () => { if (++broadcasts === 2) received.resolve(); } } });
    try {
      manual.change(); manual.change(); manual.change();
      await within(started.promise);
      manual.change(); manual.change();
      release.resolve(null);
      await within(received.promise);
      expect(reads).toBe(2);
      expect(maxActive).toBe(1);
    } finally { release.resolve(null); await watcher.stop(); }
  });
});


test("an asynchronous watcher error is reported", async () => {
  await fixture(async dir => {
    let emitError!: (error: unknown) => void;
    const errors: unknown[] = [];
    const watcher = watchPlans({ plansDir: dir, channel: { broadcast() {} }, onError: e => errors.push(e),
      watch: () => ({ close() {}, on: (_event, listener) => { emitError = listener; } }) });
    try {
      const error = new Error("watch unavailable");
      emitError(error);
      expect(errors).toEqual([error]);
    } finally { await watcher.stop(); }
  });
});

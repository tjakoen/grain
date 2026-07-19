// proof/init.test.ts — `proof init`: scaffold correctness, idempotency, and force-overwrite.
// Hermetic: runs against a fresh temp dir under node:os tmpdir, cleaned up after each test.
import { test, expect, afterEach } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "./init.ts";
import { parsePlan } from "./core/schema.ts";

const dirs: string[] = [];

async function freshDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "proof-init-test-"));
  dirs.push(dir);
  return dir;
}

afterEach(async () => {
  while (dirs.length) {
    const dir = dirs.pop()!;
    await rm(dir, { recursive: true, force: true });
  }
});

test("runInit scaffolds all four files on a fresh dir", async () => {
  const dir = await freshDir();
  const result = await runInit(dir);

  expect(result.created.sort()).toEqual(
    [
      join("plans", "000-welcome.md"),
      join("plans", "README.md"),
      join("plans", ".proof", "session-start.sh"),
      join("plans", ".proof", "pre-commit.sh"),
    ].sort(),
  );
  expect(result.skipped).toEqual([]);
  expect(result.instructions.length).toBeGreaterThan(0);

  // every file actually landed on disk
  for (const rel of result.created) {
    const content = await readFile(join(dir, rel), "utf8");
    expect(content.length).toBeGreaterThan(0);
  }
});

test("the scaffolded welcome plan parses cleanly with status todo, owner ai", async () => {
  const dir = await freshDir();
  await runInit(dir);

  const raw = await readFile(join(dir, "plans", "000-welcome.md"), "utf8");
  const { plan, errors } = parsePlan(raw, "000-welcome");

  expect(errors).toEqual([]);
  expect(plan.status).toBe("todo");
  expect(plan.owner).toBe("ai");
  expect(plan.track).toBeNull();
  expect(plan.depends).toEqual([]);
  expect(plan.touches).toEqual([]);
  expect(plan.title.length).toBeGreaterThan(0);
});

test("a second run is idempotent: nothing created, everything skipped", async () => {
  const dir = await freshDir();
  await runInit(dir);
  const second = await runInit(dir);

  expect(second.created).toEqual([]);
  expect(second.skipped.sort()).toEqual(
    [
      join("plans", "000-welcome.md"),
      join("plans", "README.md"),
      join("plans", ".proof", "session-start.sh"),
      join("plans", ".proof", "pre-commit.sh"),
    ].sort(),
  );
});

test("force:true re-creates existing files", async () => {
  const dir = await freshDir();
  await runInit(dir);
  const forced = await runInit(dir, { force: true });

  expect(forced.skipped).toEqual([]);
  expect(forced.created.length).toBe(4);
});

test("runInit never touches files outside the four scaffold paths", async () => {
  const dir = await freshDir();
  const result = await runInit(dir);

  const allowed = new Set([
    join("plans", "000-welcome.md"),
    join("plans", "README.md"),
    join("plans", ".proof", "session-start.sh"),
    join("plans", ".proof", "pre-commit.sh"),
  ]);
  for (const rel of result.created) {
    expect(allowed.has(rel)).toBe(true);
  }
});

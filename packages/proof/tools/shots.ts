// proof/tools/shots.ts — capture the board (light + dark) + a card detail to proof/screenshots/.
// Boots the real server against the example plans, drives chromium, writes PNGs. Dev-only.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { serveProof } from "../serve.ts";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "screenshots");
const PORT = 4388;

const proof = serveProof({ plansDir: join(dirname(fileURLToPath(import.meta.url)), "..", "example"), port: PORT });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const shots: Array<[string, string, "light" | "dark"]> = [
  ["/", "board-light", "light"],
  ["/", "board-dark", "dark"],
  ["/plan/001-core-parser", "detail-light", "light"],
];

for (const [path, name, scheme] of shots) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, colorScheme: scheme });
  await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
  await page.close();
  console.log(`shot: ${name}.png`);
}

await browser.close();
proof.stop();

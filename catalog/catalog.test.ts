// grain/catalog/catalog.test.ts — the catalog page shell honors the injection seams.
// The catalog builds its OWN <html> shell (it isn't a pages/ file), so it must accept the
// same global assets the page server injects — otherwise it becomes the one page that
// drifts from the rest (the saved-theme bug that motivated the seam).
import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCatalog } from "./catalog.ts";

describe("createCatalog inject seams", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "batch-catalog-"));
    await mkdir(join(dir, "atoms", "b-x"), { recursive: true });
    await writeFile(join(dir, "atoms", "b-x", "b-x.md"), `# B X\n\nA test atom.\n`);
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  test("headEnd lands in <head>, bodyEnd before </body>", async () => {
    const catalog = createCatalog(dir, undefined,
      { headEnd: `<script src="/boot.js"></script>`, bodyEnd: `<script src="/island.js" defer></script>` });
    const html = await catalog.html();
    const head = html.slice(0, html.indexOf("</head>"));
    const body = html.slice(html.indexOf("<body>"));
    expect(head).toContain(`<script src="/boot.js"></script>`);
    expect(body).toContain(`<script src="/island.js" defer></script>`);
  });

  test("no inject → shell renders without placeholders", async () => {
    const catalog = createCatalog(dir);
    const html = await catalog.html();
    expect(html).toContain("<title>Component Catalog</title>");
    expect(html).not.toContain("undefined");
  });
});

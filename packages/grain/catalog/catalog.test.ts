// grain/catalog/catalog.test.ts — the catalog page shell honors the injection seams.
// The catalog builds its OWN <html> shell (it isn't a pages/ file), so it must accept the
// same global assets the page server injects — otherwise it becomes the one page that
// drifts from the rest (the saved-theme bug that motivated the seam).
import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCatalog, parseControl } from "./catalog.ts";

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

// A component that owns the window (a deck at position: fixed) rendered live inside a panel
// covers the whole catalog page — the failure that motivated the `flat` fence tag.
describe("flat panels render source only", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "batch-catalog-flat-"));
    await mkdir(join(dir, "organisms", "deck"), { recursive: true });
    await writeFile(join(dir, "organisms", "deck", "deck.md"),
      "# Deck\n\n## Markup\n\n```html flat\n<div class=\"deck-live-marker\"></div>\n```\n\n" +
      "## Live\n\n```html\n<div class=\"other-live-marker\"></div>\n```\n");
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  test("a ```html flat fence keeps its markup out of the live panel", async () => {
    const html = await (createCatalog(dir)).html();
    // the flat panel: no live node, but the copyable source survives escaped
    expect(html).not.toContain(`<div class="deck-live-marker">`);
    expect(html).toContain("&lt;div class=&quot;deck-live-marker&quot;&gt;");
    expect(html).toContain("panel__flat");
    // an untagged fence in the same doc still renders live
    expect(html).toContain(`<div class="other-live-marker">`);
  });

  test("each component entry carries a data-surface address", async () => {
    const html = await (createCatalog(dir)).html();
    expect(html).toContain(`data-surface="catalog:deck"`);
  });
});

// The explorer: a ```controls fence becomes a playground, an Accessibility section becomes its own
// block, and the sidebar search carries the status line it announces into (plans/catalog-explorer.md).
describe("catalog explorer", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "batch-catalog-play-"));
    await mkdir(join(dir, "dashboards", "tile"), { recursive: true });
    await writeFile(join(dir, "dashboards", "tile", "tile.md"),
      "# Tile\n\nA counted thing.\n\n## Default\n\n```html\n<div class=\"tile\"><b class=\"tile__v\">3</b></div>\n```\n\n" +
      "```controls\nselect data-tone = - | bad\ntoggle data-commit = pending\ntext .tile__v = 3\nnot a control\n```\n\n" +
      "## Accessibility\n\nRead in source order.\n");
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  test("parseControl reads the three kinds and rejects the rest", () => {
    expect(parseControl("select data-dir @ .delta = up | down")).toEqual(
      { kind: "select", name: "data-dir", selector: ".delta", options: ["up", "down"], value: "up" });
    expect(parseControl("toggle data-commit = pending")?.value).toBe("pending");
    expect(parseControl("text .stat__value = 128")).toMatchObject({ kind: "text", selector: ".stat__value", value: "128" });
    expect(parseControl("select data-x =")).toBeNull();
    expect(parseControl("prose line")).toBeNull();
  });

  test("a controls fence renders a playground with labelled inputs and a width switch", async () => {
    const html = await createCatalog(dir).html();
    expect(html).toContain(`aria-label="Playground for Tile"`);
    expect(html).toContain(`<option value="-">none</option>`);
    expect(html).toContain(`data-kind="toggle" data-name="data-commit"`);
    expect(html).toContain(`<label for="ctl-tile-2">Text of .tile__v</label>`);
    expect(html).toContain(`data-width="phone"`);
    expect(html).not.toContain("not a control");
  });

  test("the Accessibility section is its own block, not a group heading", async () => {
    const html = await createCatalog(dir).html();
    expect(html).toContain(`class="cat-a11y"`);
    expect(html).toContain("Read in source order.");
    expect(html).not.toContain(`<h3 class="cat-group">Accessibility</h3>`);
  });

  test("search announces into a status region, opens with slash, and a skip link leads to main", async () => {
    const html = await createCatalog(dir).html();
    expect(html).toContain(`role="status" aria-live="polite"`);
    expect(html).toContain(`aria-keyshortcuts="/"`);
    expect(html).toContain(`href="#cat-main">Skip to components</a>`);
    expect(html).toContain(`data-text="a counted thing."`);
  });

  test("the catalog chrome wears no tracked capitals", async () => {
    const html = await createCatalog(dir).html();
    expect(html).not.toMatch(/text-transform:\s*uppercase/);
  });
});

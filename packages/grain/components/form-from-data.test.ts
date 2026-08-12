// grain/components/form-from-data.test.ts — conformance for the data-first form atoms.
//
// b-field / b-choice / b-option are the DATA-driven siblings of b-input / b-select: same control,
// same CSS frame, bindings instead of config props. Two mistakes would quietly break that deal, and
// both are the kind grain's CLAUDE.md says to design out rather than patch on the instance:
//
//   1. Shipping a stylesheet here. The whole reason these atoms exist without one is that the frame
//      is b-input.css, so the sizes, the inline variant and the AI treatment cannot drift from the
//      component they mirror. A second stylesheet describing the same control is how two components
//      become two designs.
//   2. Mixing config props and data bindings for the SAME key. `prop-*` resolves in PASS 0 from a
//      LITERAL attribute on the tag, so it is identical for every item of an `each` — exactly what a
//      per-field label must not be. Put both on one element and the config wins on some keys and the
//      binding blanks others. That collision is why this is a sibling atom and not a retrofit of
//      b-input, and it is worth a test because the two markers look interchangeable in a template.
//
// The rendering itself is not tested here: grain imports nothing from the substrate, so it has no
// renderer to call. That proof lives with the consumer that owns createRenderer.
import { test, expect } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ATOMS = join(import.meta.dir, "atoms");
const DATA_FIRST = ["b-field", "b-choice", "b-option"];
const read = (name: string) => readFileSync(join(ATOMS, name, `${name}.html`), "utf8");

// The per-item content keys. Each must arrive as a binding, never as a config prop.
const CONTENT_KEYS = ["label", "name", "type", "placeholder", "value", "required", "selected"];

test("the data-first form atoms ship no CSS (the frame is b-input.css)", () => {
  const withCss = DATA_FIRST.filter((n) => readdirSync(join(ATOMS, n)).some((f) => f.endsWith(".css")));
  expect(withCss).toEqual([]);
});

test("every class they use is already declared by the components they mirror", () => {
  const frame = readFileSync(join(ATOMS, "b-input", "b-input.css"), "utf8")
    + readFileSync(join(ATOMS, "b-select", "b-select.css"), "utf8");
  const unknown: string[] = [];
  for (const name of DATA_FIRST) {
    for (const m of read(name).matchAll(/\bclass="([^"]+)"/g)) {
      for (const cls of m[1].split(/\s+/).filter(Boolean)) {
        if (!frame.includes(`.${cls}`)) unknown.push(`${name}: .${cls}`);
      }
    }
  }
  expect(unknown).toEqual([]);
});

test("content comes from data, never from a config prop", () => {
  const offenders: string[] = [];
  for (const name of DATA_FIRST) {
    const html = read(name);
    for (const key of CONTENT_KEYS) {
      if (new RegExp(`prop-(attr-[\\w-]+|text)="${key}"`).test(html)) offenders.push(`${name}: ${key}`);
    }
  }
  expect(offenders).toEqual([]);
});

test("b-field binds every key the field spec carries", () => {
  const html = read("b-field");
  for (const attr of ["name", "type", "value", "placeholder", "required"]) {
    expect(html).toContain(`data-bind-${attr}="${attr}"`);
  }
  expect(html).toContain(`data-field="label"`);
  // The surface binding is the reason a generated form is AI-operable at all: it lands as
  // data-surface="field:…" per item, which is what field.set resolves against.
  expect(html).toContain(`data-bind-data-surface="surface"`);
  // WHERE it lands is the whole of it, and asserting only that the binding exists is what let this
  // ship wrong. field.set resolves the address and then writes el.value, so the address has to be on
  // the input. On the label it points at something with nothing to write into and the write is
  // dropped in silence. Assert the binding sits on the input line, and that the label carries none.
  const inputLine = html.split("\n").find((l) => l.includes("class=\"field__input\""))!;
  expect(inputLine).toContain(`data-bind-data-surface="surface"`);
  const labelLine = html.split("\n").find((l) => l.includes("class=\"field\""))!;
  expect(labelLine).not.toContain(`data-bind-data-surface`);
  // Presentation IS form-wide, so these two stay config props on purpose.
  expect(html).toContain(`prop-attr-data-size="size"`);
  expect(html).toContain(`prop-attr-data-variant="variant"`);
});

test("b-choice nests b-option over the item's own options array", () => {
  expect(read("b-choice")).toContain(`<b-option each="options">`);
  expect(read("b-option")).toContain(`data-bind-value="value"`);
});

test("b-choice addresses the select, matching b-field's control-not-label rule", () => {
  const html = read("b-choice");
  const selectLine = html.split("\n").find((l) => l.includes("class=\"field__select\""))!;
  expect(selectLine).toContain(`data-bind-data-surface="surface"`);
  const labelLine = html.split("\n").find((l) => l.includes("class=\"field\""))!;
  expect(labelLine).not.toContain(`data-bind-data-surface`);
});

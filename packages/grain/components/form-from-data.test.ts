// grain/components/form-from-data.test.ts — conformance for the data-first form atoms.
//
// b-field / b-choice / b-option / b-memo are the DATA-driven siblings of b-input / b-select /
// b-textarea: same control, same CSS frame, bindings instead of config props. Two mistakes would
// quietly break that deal, and both are the kind grain's CLAUDE.md says to design out rather than
// patch on the instance:
//
//   1. Shipping a stylesheet here. The whole reason these atoms exist without one is that the frame
//      is b-input.css and the controls are b-select.css and b-textarea.css, so the sizes, the inline
//      variant and the AI treatment cannot drift from the component they mirror. A second stylesheet describing the same control is how two components
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
const DATA_FIRST = ["b-field", "b-choice", "b-option", "b-memo", "b-check"];
const read = (name: string) => readFileSync(join(ATOMS, name, `${name}.html`), "utf8");
/** The templates that wrap a control in the .field frame and therefore own the message slots. */
const FRAMED = ["b-input", "b-textarea", "b-checkbox", "b-radio", "b-field", "b-choice", "b-memo", "b-check"];

// The per-item content keys. Each must arrive as a binding, never as a config prop.
const CONTENT_KEYS = ["label", "name", "type", "placeholder", "value", "required", "selected"];

/** The whole opening tag carrying `class="<cls>"`, attributes included, however many lines it is
 *  wrapped across. The assertions below are about WHICH ELEMENT an attribute sits on, and a
 *  line-by-line search answers that question only while the template happens to fit on one line. */
const openTag = (html: string, cls: string): string =>
  html.match(new RegExp(`<[a-zA-Z][a-zA-Z0-9]*[^>]*class="${cls}"[^>]*>`))?.[0] ?? "";

test("the data-first form atoms ship no CSS (the frame is b-input.css)", () => {
  const withCss = DATA_FIRST.filter((n) => readdirSync(join(ATOMS, n)).some((f) => f.endsWith(".css")));
  expect(withCss).toEqual([]);
});

test("every class they use is already declared by the components they mirror", () => {
  const frame = readFileSync(join(ATOMS, "b-input", "b-input.css"), "utf8")
    + readFileSync(join(ATOMS, "b-select", "b-select.css"), "utf8")
    + readFileSync(join(ATOMS, "b-textarea", "b-textarea.css"), "utf8")
    + readFileSync(join(ATOMS, "b-checkbox", "b-checkbox.css"), "utf8");
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
  // dropped in silence. Assert the binding sits on the input itself, and the label carries none.
  expect(openTag(html, "field__input")).toContain(`data-bind-data-surface="surface"`);
  expect(openTag(html, "field")).not.toContain(`data-bind-data-surface`);
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
  expect(openTag(html, "field__select")).toContain(`data-bind-data-surface="surface"`);
  expect(openTag(html, "field")).not.toContain(`data-bind-data-surface`);
});

test("b-memo addresses the textarea, matching the same control-not-label rule", () => {
  const html = read("b-memo");
  expect(openTag(html, "field__textarea")).toContain(`data-bind-data-surface="surface"`);
  expect(openTag(html, "field")).not.toContain(`data-bind-data-surface`);
});

// The one way b-memo cannot copy b-field, and it is invisible in a diff: a textarea has no `value`
// ATTRIBUTE. Its value is its content. `data-bind-value="value"` would render value="…" onto a
// textarea, the browser would ignore it, and the box would come up empty with nothing warning —
// exactly the shape of failure the label addressing had. So the value arrives through data-field
// (setInnerContent) and the attribute binding must never appear here.
test("b-memo binds its value as CONTENT, never as a value attribute", () => {
  const html = read("b-memo");
  // The markup only: this atom's own comment names the marker it must not use, and a scan that
  // cannot tell a rule from its explanation would fail on a template that is entirely correct.
  expect(html.replace(/<!--[\s\S]*?-->/g, "")).not.toContain(`data-bind-value`);
  expect(openTag(html, "field__textarea")).toContain(`data-field="value"`);
  for (const attr of ["name", "placeholder", "required"]) {
    expect(html).toContain(`data-bind-${attr}="${attr}"`);
  }
  expect(html).toContain(`data-field="label"`);
});

// Height is presentation, so it is form-wide config like size and variant, not a per-item data key.
// Binding it per item would be the first crack in the split the whole family rests on.
test("b-memo takes its height as form-wide config, not as per-item data", () => {
  const html = read("b-memo");
  expect(html).toContain(`prop-attr-rows="rows"`);
  expect(html).not.toContain(`data-bind-rows`);
  expect(html).toContain(`prop-attr-data-size="size"`);
  expect(html).toContain(`prop-attr-data-variant="variant"`);
});

// b-textarea is the authoring-time sibling that OWNS the control's stylesheet, the way b-select owns
// .field__select for b-choice. If it ever stopped declaring the class, b-memo would render an
// unstyled box and the test above would still pass, so the ownership is asserted here rather than
// assumed.
test("b-textarea declares the control class its data-first sibling reuses", () => {
  const css = readFileSync(join(ATOMS, "b-textarea", "b-textarea.css"), "utf8");
  expect(css).toContain(`.field__textarea`);
  expect(readdirSync(join(ATOMS, "b-textarea")).filter((f) => f.endsWith(".css"))).toEqual(["b-textarea.css"]);
});

// ---- the tick box, and the renderer behaviour that decided its shape -------------------------
//
// The obvious design is ONE authoring-time atom with a `type` prop. Measured on 2026-08-13 through
// createRenderer: PASS 0 APPENDS a prop's attribute rather than replacing a literal one already in
// the template, so `<b-checkbox type="radio">` renders `type="checkbox" type="radio"` and the browser
// honors the first. A radio that is silently a checkbox is exactly the class of failure this family
// has now hit three times, so the type is a literal and there are two templates.
test("b-checkbox and b-radio each state their own type, with no prop that could shadow it", () => {
  for (const [name, type] of [["b-checkbox", "checkbox"], ["b-radio", "radio"]] as const) {
    const html = read(name).replace(/<!--[\s\S]*?-->/g, "");
    expect(openTag(html, "field__box")).toContain(`type="${type}"`);
    // A prop-attr-type alongside the literal would render both and change nothing. Ban it outright.
    expect(html).not.toContain(`prop-attr-type`);
  }
});

test("b-checkbox declares the control class b-radio and b-check both reuse", () => {
  const css = readFileSync(join(ATOMS, "b-checkbox", "b-checkbox.css"), "utf8");
  expect(css).toContain(`.field__box`);
  expect(readdirSync(join(ATOMS, "b-checkbox")).filter((f) => f.endsWith(".css"))).toEqual(["b-checkbox.css"]);
  // b-radio is authoring-time but adds no rule of its own; if it ever grows one, the two controls
  // have started drifting and this is where that shows up.
  expect(readdirSync(join(ATOMS, "b-radio")).filter((f) => f.endsWith(".css"))).toEqual([]);
});

// The data-first side can do in one atom what the authoring side needs two for, because a BINDING
// replaces where a config prop appends. That inversion is the whole reason b-check exists once.
test("b-check takes its type from data, with no literal to shadow the binding", () => {
  const html = read("b-check").replace(/<!--[\s\S]*?-->/g, "");
  expect(html).toContain(`data-bind-type="type"`);
  expect(openTag(html, "field__box")).not.toContain(`type="checkbox"`);
  expect(openTag(html, "field__box")).not.toContain(`type="radio"`);
  // The name is per-item data on purpose: a radio GROUP is made by every item sharing one name, and
  // a form-wide config prop would have forced that on every group the page renders.
  expect(html).toContain(`data-bind-name="name"`);
  expect(html).toContain(`data-bind-checked="checked"`);
});

// The deliberate ABSENCE, asserted so the next reader cannot tidy it away as an oversight. Every
// other atom in this family carries a surface, and this one must not: field.set is the only verb the
// vocabulary has for a field, it writes el.value, and a checkbox's value is what the form SUBMITS
// rather than whether it is ticked. A write would land, report success, change the form's meaning and
// leave the control looking untouched — worse than the choice hazard, which at least blanks visibly.
// When a verb exists that can tick a box, delete this test in the same commit that adds the binding.
test("b-check carries NO surface: the vocabulary has no verb that can tick a box", () => {
  expect(read("b-check")).not.toContain(`data-bind-data-surface`);
});

// ---- the two message slots, and the required marker ------------------------------------------
//
// Both slots ship in every framed template, which is only safe because they collapse when empty.
// Measured the same day: a prop-text whose prop is NOT supplied leaves the template's own text in
// place, so a slot carrying a fallback would print that fallback on every field nobody wrote a hint
// for. The fallback has to be empty, and that is invisible in a diff unless something asserts it.
test("every framed control carries a hint and an error slot", () => {
  const missing: string[] = [];
  for (const name of FRAMED) {
    const html = read(name);
    for (const slot of ["hint", "error"]) {
      if (!html.includes(`class="field__${slot}"`)) missing.push(`${name}: .field__${slot}`);
    }
  }
  expect(missing).toEqual([]);
});

test("a message slot's fallback content is empty, or it prints on every field that has no message", () => {
  const offenders: string[] = [];
  for (const name of FRAMED) {
    for (const m of read(name).matchAll(/<span class="field__(hint|error)"[^>]*>([\s\S]*?)<\/span>/g)) {
      if (m[2]!.trim() !== "") offenders.push(`${name}: .field__${m[1]} fallback is ${JSON.stringify(m[2])}`);
    }
  }
  expect(offenders).toEqual([]);
});

test("the frame declares both slots, hides them when empty, and marks a required label itself", () => {
  const css = readFileSync(join(ATOMS, "b-input", "b-input.css"), "utf8");
  expect(css).toContain(`.field__hint`);
  expect(css).toContain(`.field__error`);
  // The collapse is what makes an unconditional slot safe; without it every field grows a gap.
  expect(css).toMatch(/\.field__hint:empty[^{]*\{[^}]*display:\s*none/);
  // The marker reads the attribute the browser already enforces, so it cannot drift from it and no
  // author can forget it. A marker carried in markup instead would be a second source of truth.
  expect(css).toMatch(/\.field:has\(:required\)\s+\.field__label::after/);
  // An error is weight against the hint's fade, never a hue of its own (DESIGN-SYSTEM §2).
  expect(css).not.toMatch(/\.field__error[^{]*\{[^}]*color:\s*(red|#)/);
});

// ---- what the catalog does with a doc, which is not what the file looks like ------------------
//
// Measured against the rendered page on 2026-08-13, and all three of these are silent:
//
//   1. EVERY prose line before the first `## ` is joined into ONE paragraph. Four paragraphs of
//      rationale render as one wall, which is what the owner sent this back for.
//   2. Prose under a `## ` is DROPPED — parseDoc only collects prose while no group is open. But
//      the heading is still emitted, so a prose-only section renders as a heading with nothing
//      beneath it. Worse than losing the text, because it looks broken rather than absent.
//   3. Only a ```html fence becomes a panel. A ```json fence under a group is dropped quietly; the
//      same fence BEFORE the first `## ` has its lines swept into the intro as prose, which is how
//      raw JSON braces ended up mid-sentence in two shipped docs.
//
// So a doc in this family is: a short intro, then groups that each hold at least one html fence.
// Anything else either leaks into the intro or renders as an empty heading. The rule is asserted for
// the FAMILY THIS FILE OWNS rather than estate-wide, because six other components carry the same
// defect (presentation.md alone has seven empty headings) and fixing those is a different piece of
// work than this one. The list below is the scope, and the honest reading of a green run here is
// "the field family is clean", not "the catalog is".
const FAMILY_DOCS = [
  ["atoms", "b-input"], ["atoms", "b-field"], ["atoms", "b-select"], ["atoms", "b-choice"],
  ["atoms", "b-textarea"], ["atoms", "b-memo"], ["atoms", "b-checkbox"], ["atoms", "b-radio"],
  ["atoms", "b-check"], ["molecules", "form-grid"],
] as const;
const COMPONENTS = join(import.meta.dir);
const readDoc = (layer: string, name: string) =>
  readFileSync(join(COMPONENTS, layer, name, `${name}.md`), "utf8");

/** Everything before the first `## `, which is the whole of what the catalog prints as the intro. */
const introOf = (md: string): string =>
  md.split("\n").slice(0, md.split("\n").findIndex((l) => l.startsWith("## ")) + 1 || undefined)
    .filter((l) => !l.startsWith("#") && !l.startsWith("## ") && l.trim()).join(" ");

test("a family doc's intro stays readable as one paragraph, because that is what it becomes", () => {
  // The catalog median sits near 600 characters. 1100 is generous rather than tight, and the four
  // docs that prompted this were between 1400 and 2100.
  const tooLong = FAMILY_DOCS
    .map(([layer, name]) => [name, introOf(readDoc(layer, name)).length] as const)
    .filter(([, n]) => n > 1100);
  expect(tooLong).toEqual([]);
});

test("no fence sits before the first heading, or its lines are swept into the intro as prose", () => {
  const offenders: string[] = [];
  for (const [layer, name] of FAMILY_DOCS) {
    const head = readDoc(layer, name).split(/^## /m)[0]!;
    if (head.includes("```")) offenders.push(`${name}: a fence before the first heading`);
  }
  expect(offenders).toEqual([]);
});

test("every group in a family doc holds a live panel, or it renders as an empty heading", () => {
  const offenders: string[] = [];
  for (const [layer, name] of FAMILY_DOCS) {
    for (const part of readDoc(layer, name).split(/^## /m).slice(1)) {
      if (!part.includes("```html")) offenders.push(`${name}: "${part.split("\n")[0]!.trim()}"`);
    }
  }
  expect(offenders).toEqual([]);
});

// ---- the layout ------------------------------------------------------------------------------
test("form-grid is CSS only, and its auto-fit floor cannot overflow a narrow viewport", () => {
  const dir = join(import.meta.dir, "molecules", "form-grid");
  expect(readdirSync(dir).sort()).toEqual(["form-grid.css", "form-grid.md"]);
  const css = readFileSync(join(dir, "form-grid.css"), "utf8");
  // The classic auto-fit bug: a bare minmax floor wider than the screen scrolls the page sideways,
  // and it only ever shows up on a real device. min(floor, 100%) is the fix, so pin it.
  expect(css).toMatch(/minmax\(min\(var\(--form-grid-min\), 100%\), 1fr\)/);
  // A message box spans without being asked; that rule is the reason this component earns its place.
  expect(css).toMatch(/\.form-grid > \.field:has\(\.field__textarea\)/);
});

// mill/adapters/grain/date-rail.test.ts: the `layout: timeline` authoring contract.
import { test, expect } from "bun:test";
import { renderGrainDocument } from "./grain-adapter.ts";
import { dateRailBody } from "./date-rail.ts";

const note = `---
title: A dated story
layout: timeline
---

Lead paragraph.

## Aug 18 · Then it had to keep score

First.

## Sep 17 · The talk was the old version

Second.

## No date here

Third.
`;

test("layout: timeline wraps each H2 and its prose in a rail section with its date", () => {
  const { html } = renderGrainDocument(note);
  expect(html).toContain(`<article class="note" data-layout="timeline" data-grade="smooth">`);
  expect(html).toContain(`<p>Lead paragraph.</p><div class="date-rail">`);
  expect(html).toContain(`<section class="date-rail__section"><p class="date-rail__date"><time>Aug 18</time></p><div class="date-rail__body"><h2 id="then-it-had-to-keep-score">Then it had to keep score</h2><p>First.</p></div></section>`);
  expect(html).toContain(`<time>Sep 17</time>`);
  expect(html.match(/date-rail__section/g)?.length).toBe(3);
});

test("the anchor is slugged from the heading text without the date", () => {
  const { html } = renderGrainDocument(note);
  expect(html).not.toContain(`id="aug-18`);
  expect(html).toContain(`id="the-talk-was-the-old-version"`);
});

test("an H2 with no marker still gets a section, with an empty hidden rail slot", () => {
  const { html } = renderGrainDocument(note);
  expect(html).toContain(`<p class="date-rail__date" aria-hidden="true"></p><div class="date-rail__body"><h2 id="no-date-here">`);
});

test("without the flag, the marker is left alone and no rail is emitted", () => {
  const { html } = renderGrainDocument(note.replace("layout: timeline\n", ""));
  expect(html).not.toContain("date-rail");
  expect(html).not.toContain("data-layout");
  expect(html).toContain("Aug 18 · Then it had to keep score");
});

test("a middle dot late in a heading is not a date marker", () => {
  const out = dateRailBody(`<h2 id="x">A very long heading that runs on · and on</h2>`);
  expect(out).toContain(`<p class="date-rail__date" aria-hidden="true"></p>`);
  expect(out).toContain(`A very long heading that runs on · and on`);
});

test("a body with no H2 is returned untouched", () => {
  expect(dateRailBody("<p>Just prose.</p>")).toBe("<p>Just prose.</p>");
});

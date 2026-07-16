// mill/core/frontmatter.test.ts — the YAML-ish frontmatter splitter.
import { test, expect } from "bun:test";
import { parseFrontmatter } from "./frontmatter.ts";

test("splits scalars and returns the body", () => {
  const { data, body } = parseFrontmatter(`---\ntitle: Hello\ntype: note\n---\n# Body\n\ntext`);
  expect(data.title).toBe("Hello");
  expect(data.type).toBe("note");
  expect(body).toBe("# Body\n\ntext");
});

test("no frontmatter → empty data, body untouched", () => {
  const { data, body } = parseFrontmatter(`# Just markdown\n\nno fence`);
  expect(data).toEqual({});
  expect(body).toBe("# Just markdown\n\nno fence");
});

test("no closing fence is NOT treated as frontmatter", () => {
  const raw = `---\ntitle: dangling`;
  const { data, body } = parseFrontmatter(raw);
  expect(data).toEqual({});
  expect(body).toBe(raw);
});

test("inline list syntax (simple comma split; quote a value to keep spaces)", () => {
  const { data } = parseFrontmatter(`---\ntags: [ai, "design systems", htmx]\n---\nx`);
  expect(data.tags).toEqual(["ai", "design systems", "htmx"]);
});

test("dash list under a key", () => {
  const { data } = parseFrontmatter(`---\ntags:\n  - ai\n  - design\n---\nx`);
  expect(data.tags).toEqual(["ai", "design"]);
});

test("strips surrounding quotes and a leading BOM", () => {
  const { data } = parseFrontmatter(`﻿---\ntitle: "Quoted Title"\n---\nx`);
  expect(data.title).toBe("Quoted Title");
});

test("a double-quoted scalar unescapes `\\\"` and `\\\\`", () => {
  const { data } = parseFrontmatter(`---\ntitle: "\\"Vibe coder\\" \\\\ ship"\n---\nx`);
  expect(data.title).toBe(`"Vibe coder" \\ ship`);
});

test("a single-quoted scalar keeps backslashes verbatim (no YAML escaping)", () => {
  const { data } = parseFrontmatter(`---\ntitle: 'a\\nb'\n---\nx`);
  expect(data.title).toBe(`a\\nb`);
});

test("carriage returns are tolerated", () => {
  const { data, body } = parseFrontmatter(`---\r\ntitle: CRLF\r\n---\r\nbody`);
  expect(data.title).toBe("CRLF");
  expect(body).toBe("body");
});

test("folded block scalar (`key: >`) joins indented lines with spaces", () => {
  const { data } = parseFrontmatter("---\nsummary: >\n  line one\n  line two\ntitle: After\n---\nbody");
  expect(data.summary).toBe("line one line two");
  expect(data.title).toBe("After");
});

test("literal block scalar (`key: |`) keeps newlines", () => {
  const { data } = parseFrontmatter("---\nnotes: |\n  a\n  b\n---\nbody");
  expect(data.notes).toBe("a\nb");
});

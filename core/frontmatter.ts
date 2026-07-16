// mill/core/frontmatter.ts — split a `---` YAML-ish frontmatter block off the body.
// Deliberately a tiny subset (no library, zero runtime deps — the batch bar): scalars,
// inline lists `[a, b]`, dash lists under a key, and folded/literal block scalars
// (`key: >` / `key: |` — the shape real notes use for `summary:`). Enough for
// title/type/date/tags/summary/desc.
import type { Frontmatter } from "./types.ts";

export interface ParsedFrontmatter { data: Frontmatter; body: string; }

const FENCE = /^---\s*$/;

export function parseFrontmatter(raw: string): ParsedFrontmatter {
  const text = raw.replace(/^﻿/, "");            // strip a leading BOM
  const lines = text.split(/\r\n?|\n/);
  if (lines[0] === undefined || !FENCE.test(lines[0])) return { data: {}, body: text };

  let end = -1;
  for (let i = 1; i < lines.length; i++) if (FENCE.test(lines[i])) { end = i; break; }
  if (end === -1) return { data: {}, body: text };    // no closing fence → not frontmatter

  const data = parseYamlish(lines.slice(1, end));
  const body = lines.slice(end + 1).join("\n").replace(/^\n+/, "");
  return { data, body };
}

// Strip surrounding quotes. Double-quoted scalars process YAML escapes (`\"`, `\\`);
// single-quoted scalars are verbatim inside (no backslash escaping in YAML).
const unquote = (s: string) => {
  const m = s.match(/^(["'])(.*)\1$/);
  if (!m) return s;
  return m[1] === '"' ? m[2].replace(/\\(["\\])/g, "$1") : m[2];
};

function parseYamlish(lines: string[]): Frontmatter {
  const data: Frontmatter = {};
  let currentKey: string | null = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") { i++; continue; }

    // a dash list item belongs to the most recent key
    const item = line.match(/^\s*-\s+(.*)$/);
    if (item && currentKey) {
      const arr = Array.isArray(data[currentKey]) ? (data[currentKey] as string[]) : [];
      arr.push(unquote(item[1].trim()));
      data[currentKey] = arr;
      i++; continue;
    }

    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) { i++; continue; }
    const key = kv[1];
    const rawVal = kv[2].trim();
    currentKey = key;
    i++;
    if (rawVal === "") continue;                       // value may follow as dash items

    // block scalar: `key: >` folds continuation lines with spaces, `key: |` keeps newlines.
    // Continuation = every following line that is indented (or blank), until a flush-left line.
    if (rawVal === ">" || rawVal === "|") {
      const buf: string[] = [];
      while (i < lines.length && (lines[i].trim() === "" || /^\s/.test(lines[i]))) {
        buf.push(lines[i].trim());
        i++;
      }
      while (buf.length && buf[buf.length - 1] === "") buf.pop();   // drop trailing blanks
      data[key] = buf.join(rawVal === ">" ? " " : "\n").trim();
      continue;
    }

    if (rawVal.startsWith("[") && rawVal.endsWith("]")) {
      data[key] = rawVal.slice(1, -1).split(",").map(s => unquote(s.trim())).filter(s => s !== "");
    } else {
      data[key] = unquote(rawVal);
    }
  }
  return data;
}

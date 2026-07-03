// mill/core/index.ts — the framework-agnostic core's public surface.
export * from "./types.ts";
export { parseFrontmatter } from "./frontmatter.ts";
export type { ParsedFrontmatter } from "./frontmatter.ts";
export { parseMarkdown, parseInline, inlineText } from "./markdown.ts";
export { renderDocument, escapeHtml } from "./engine.ts";
export { assertHumanGrade, findGrainViolation } from "./grade.ts";

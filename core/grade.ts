// mill/core/grade.ts — the grade guardrail (mill/PLAN.md). MILL output is HUMAN-authored
// content → clean ink: never `data-commit`, never `data-grade="grain"`, never `.is-ai`.
// Only the AI grains (grain = AI provenance). This makes that contract machine-checkable
// rather than a comment: renderGrainDocument runs it, and adapter tests assert it.

// Returns the offending marker if the output would read as AI-authored, else null.
// Each check is anchored to a LITERAL quote, so a grain marker mentioned inside a code
// block (escaped to `data-commit=&quot;…&quot;`) is inert — only real emitted ATTRIBUTES
// (with literal quotes) trip it. This matters: MILL renders the GRAIN/AI-INTERFACE docs,
// whose fenced code samples are full of `data-commit` / `data-grade="grain"`.
export function findGrainViolation(html: string): string | null {
  if (/data-commit\s*=\s*["']/.test(html))          return "data-commit";
  if (/data-grade\s*=\s*["']grain["']/.test(html))  return 'data-grade="grain"';
  if (/class\s*=\s*["'][^"']*\bis-ai\b/.test(html)) return "is-ai";
  return null;
}

export function assertHumanGrade(html: string): void {
  const marker = findGrainViolation(html);
  if (marker) {
    throw new Error(
      `[mill] grade guardrail: rendered content must be clean/human, found "${marker}". ` +
      `MILL renders human-authored Markdown — only the AI grains.`,
    );
  }
}

# made-with

The system **byline**: `made with GRAIN by tjakoen`. One quiet mono line, mounted at the
bottom of every GRAIN app's shell, so provenance reads identically across the fleet. Links:
*GRAIN* → the design-system docs home, *tjakoen* → the portfolio.

CSS-only (no `.html`) — but the *content* is centralized too: server-side template-literal
shells import the string helper so the line can never drift per app:

```ts
import { madeWith } from "@tjakoen/grain/scripts/made-with.js";
// block form — a standalone page footer
body += madeWith();
// inline form — inside a status-bar row
`<footer class="app-shell__status status-bar">…<span class="status-bar__spacer"></span>${madeWith({ inline: true })}</footer>`
```

Canonical markup (what the helper emits):

```html
<footer class="made-with">
  made with <a href="https://tjakoen.github.io/grain">GRAIN</a>
  by <a href="https://tjakoen.github.io">tjakoen</a>
</footer>
```

- **Block form** (default): a centered `--text-xs` mono line in `--color-muted`; links keep
  ink and underline only on hover/focus. Place it last inside `<body>` (after `<main>`).
- **Inline form** (`data-inline`, emitted as a `<span>`): inherits the row's type treatment —
  made for the right side of a `status-bar`, after the `__spacer`.
- No grade texture on the wordmark: grade only reads at ≥ `--text-2xl` (CLAUDE.md lesson 4),
  and this line is deliberately small.

**Parent contract:** none — self-sufficient anywhere. Consumers must ship
`components/molecules/made-with/made-with.css` in their stylesheet set.

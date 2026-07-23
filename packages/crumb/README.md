# 🍞 CRUMB — the guided-tour / AI-review layer

[![Made with Claude](https://img.shields.io/badge/Made_with-Claude-D97757?logo=anthropic&logoColor=white)](https://tjakoen.github.io/notes/ten-times-zero)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache_2.0-blue)](../../LICENSE)
[![Status](https://img.shields.io/badge/status-published_0.1.1-brightgreen)](PLAN.md)

**Tours as markdown, in. A guided walk, out.** CRUMB is PROOF's twin: where PROOF renders
*plans-as-markdown* as a board that never writes, CRUMB renders **tours-as-markdown** as a guided
projection that never writes. Published as `@tjakoen/crumb` and live — it's the guided-tour frame
running on tjakoen.github.io today.

## What's built

Core, routes, loader, `crumb check`, and `from-timeline` (turning grain's audit trail into a
review tour) are all built and shipping in `0.1.1`. `crumb-live.js` drives the lamp + popover
client-side. What's still open is tracked in [PLAN.md](PLAN.md).

## Quickstart

```bash
bun add @tjakoen/crumb
bunx crumb check tours/     # lint a tours/ folder
```

Mount it as a read-only layer alongside your app:

```ts
import { createCrumbRoutes } from "@tjakoen/crumb/routes.ts";

const crumbRoutes = createCrumbRoutes({ toursDir: "./tours" });
// mount crumbRoutes(pathname) inside your own request handler
```

## Read next

- **[Docs](https://tjakoen.github.io/crumb/docs)** — the full write-up.
- **[Live](https://tjakoen.github.io/crumb/)** — the guided tour running in production.
- **[PLAN.md](PLAN.md)** — the canonical plan (design, build pieces, what's left).

---
🤖 **Built with Claude, and every tour is a projection, never a fork.** I decided what "reviewed"
has to mean, Claude typed the parser that enforces it. **I don't prompt and pray, I prompt and
prove.** [How I actually work with AI, receipts and all →](https://tjakoen.github.io/notes/ten-times-zero)

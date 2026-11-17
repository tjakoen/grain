---
title: grain-lint, a tiered check for machine-made design, and the masthead without an eyebrow
date: 2026-11-17
status: partial
lane: gated
branch: grain-lint (grain), masthead-byline (portfolio)
skills: [voice, commit-standard]
scope: [packages/grain/styles/global.css, packages/grain/scripts/grain-lint*, packages/grain/scripts/fixtures/grain-lint, packages/mill/adapters/grain, packages/grain/catalog/catalog.ts]
scopeGrowth: the portfolio's pages and DESIGN-SYSTEM section 5, which the masthead call required
---

# grain-lint

## What was done

The masthead became headline, byline, rule in grain (ff0f103) and across the portfolio (73fde63f),
with the visual baselines refreshed on macOS. grain-lint landed in 60f18b1: sixteen rules as data,
a rendered mode at 360, 768 and 1280 on Playwright, a static mode with no browser, a failing
fixture per rule and one clean page. The first run's counts are in plans/grain-lint.md.

## Gate output

```
bun run check: 5 packages, each "Exited with code 0"
bun run test:
@tjakoen/grain test:  405 pass, 0 fail
@tjakoen/grain-mcp test:  55 pass, 0 fail
@tjakoen/mill test:  141 pass, 0 fail
@tjakoen/crumb test:  62 pass, 0 fail
@tjakoen/proof test:  86 pass, 0 fail
portfolio: playwright test e2e/visual.e2e.ts, 10 passed (49.6s)
```

The gates ran on the macOS host, not in the bread compose container the root CLAUDE.md names.

## Not done

- The first run's findings are recorded but not fixed or allowed. Each cluster is a design call.
- The PostToolUse hook in agent-config and the tour-standard close-out wiring are owner stops.
- The portfolio lint gate, advisory first, is an owner stop.
- The goldfish fresh-context read of one page's findings.
- The portfolio still loads grain 0.1.33 from npm, so the byline styling and the catalog fix reach
  it only with the next grain release. The baselines and the lint run used the local stylesheet.
- The slide-eyebrow kickers in the talk decks and the presentation organism are untouched.

## Needs human eyes

- The 3 floor contrast findings on /reading: the book category glyphs at 4.33:1.
- Whether the grade-toggle buttons, the catalog group headings and the chat speaker label keep
  their tracked capitals (fix them, or allow with a reason).
- The where-next card grid, which trips card-run on 20 routes.

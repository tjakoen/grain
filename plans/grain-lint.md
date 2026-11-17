---
id: grain-lint
status: doing
track: grain
depends: []
touches:
  - packages/grain/scripts/grain-lint.ts
  - packages/grain/scripts/grain-lint.test.ts
  - packages/grain/scripts/grain-lint-rules.ts
  - packages/grain/scripts/fixtures/grain-lint/
  - packages/grain/package.json
  - packages/grain/README.md
  - packages/grain/CLAUDE.md
owner: ai
---

# Render a GRAIN page and check it for the tells of machine-made design

GRAIN holds its tokens and its contract with tests, and the portfolio's WCAG gate runs axe on the
pages it serves. Nothing yet looks at a rendered page and asks whether it reads as AI-generated:
the same hero, the same labelled sections, the same sign-up at the end. The Hallmark skill
(github.com/Nutlope/hallmark) showed that a browser check against a named list of tells, sorted
into tiers, catches what a token test cannot. This plan builds GRAIN's own version of that check,
written against GRAIN's design language rather than borrowing Hallmark's taste whole.

The point is to keep slop out while an agent works with GRAIN, not to grade a page afterwards. So
the check is built for the agent first: it runs fast on one page, names the rule and the selector,
says what GRAIN would use instead, and runs inside the session that made the page, so the agent
fixes its own output before a person looks. CI is the backstop, not the main use.

## The tiers

Each rule belongs to exactly one tier, and the tier decides what a finding does.

- **Floor** blocks, with no override. Contrast below AA, a focus ring that is missing or hidden,
  motion that ignores reduced-motion, a hardcoded colour where a token belongs, horizontal scroll
  or clipped text at phone width, a form whose submit handler does nothing.
- **Reflex** blocks unless the page records a reason. These are the defaults a model falls into: an
  eyebrow over every heading, uppercase tracked labels used as decoration, one coloured word in a
  headline, a run of identical cards, a sign-up block closing every page, a hero that misses the
  first screen. An override is a `data-grain-lint-allow="rule-id: reason"` attribute on the
  element, so the reason sits next to the thing it excuses and shows up in a diff.
- **Finish** reports and never blocks: widows in headings, uneven spacing steps off the scale,
  images without a stated aspect ratio.

## The masthead call, settled 2026-11-17

GRAIN's masthead was an eyebrow, a display headline and a hairline rule (styles/global.css line
48), which stacks context above the headline the way the tell does. The owner chose to change the
pattern rather than excuse it: the masthead becomes the headline, then a byline carrying the name
and date, then the rule. Context sits below the headline, never above it. The rule this gives
grain-lint is plain: no text above a page's h1 other than breadcrumb navigation in the header, and
no labels above section headings. The uppercase tracked labels in the catalog and the command
palette are judged against the same rule in the first lint run.

## Steps

- [x] Owner settles the masthead call above.
- [x] Move the masthead to headline, byline, rule in styles/global.css and DESIGN-SYSTEM section 5,
      update every page that uses the eyebrow class, refresh the visual baselines, and screenshot
      one route before and after.
      Done 2026-11-17 in grain ff0f103 and portfolio 73fde63f (branch masthead-byline). The
      portfolio still loads grain 0.1.33 from npm, so its byline styling lands with the next
      grain release; the baselines were taken against the local stylesheet. The slide-eyebrow
      kickers in the talk decks and the presentation organism were left for the first lint run.
- [x] Owner approves the starting rule list.
- [x] Write the rules as data in grain-lint-rules.ts: id, tier, a one-line description, and a check
      that runs against the rendered DOM and computed styles.
- [x] Build grain-lint.ts on Playwright, which the portfolio already carries: load a URL or file,
      render at 360, 768 and 1280 pixels, run every rule, and print findings grouped by tier with a
      selector for each. Exit non-zero on any Floor finding, or on a Reflex finding without an allow.
- [x] Give every finding a fix line that points at GRAIN: the token, component or pattern to use
      instead, so the agent's correction lands inside the system rather than in fresh CSS.
- [x] Add a static mode that runs without a browser in under a second (hardcoded colours, raw
      spacing values, eyebrow and tracked-caps markup), so it can run on every edit.
- [ ] Wire the static mode as a PostToolUse hook on edits to GRAIN surfaces in Claude Code and
      Codex, and add the rendered mode to the tour-standard close-out, so an agent runs it before
      calling a rendered change done.
- [x] Reuse the existing axe run for contrast and focus rather than writing those rules twice.
- [x] Add one fixture page per rule that fails it and one clean page that passes every rule, and
      test each rule against its pair.
- [ ] Run it over the catalog and the portfolio routes, fix or allow each finding, and record the
      counts in this plan.
      First run, 2026-11-17, rendered at 360, 768 and 1280 against the local stylesheet:
      - Portfolio, 23 routes without the catalog: 121 findings. Floor: contrast-aa 3 (the book
        category glyphs on /reading, 4.33:1). Reflex: tracked-caps 68, card-run 34,
        label-above-heading 13. Finish: image-ratio 2, heading-widow 1.
      - Catalog: 403 findings on the published grain 0.1.33, 203 with this branch's catalog.
        Reflex: tracked-caps 196 (grade-toggle buttons 100, cat-group headings 64, chat-message
        speaker 27 and others), label-above-heading 3. Finish: heading-widow 2, image-ratio 2.
      - Static mode over grain's components and styles: 46 findings, tracked-caps 20 and
        off-scale-space 26, no raw colours. It ran in under a tenth of a second.
      Not yet fixed or allowed: each tracked-caps and card-run cluster is a design call (the
      grade toggle, the catalog group headings, the where-next card grid), so they wait for the
      owner rather than being excused in bulk.
- [ ] Wire it into the portfolio's lint gate as advisory first, the same way lint-gate.ts treats its
      baseline, and turn Floor into a hard failure once the baseline is clean.
- [ ] Document the rules, the tiers and the allow attribute in the grain README and CLAUDE.md.
- [ ] Hand the rendered findings for one page to the goldfish agent for a fresh-context read, to
      learn whether the rule list misses something a cold reviewer sees.

## Done means

The check runs from one command against any GRAIN page, every rule has a failing and a passing
fixture, the catalog and the portfolio pass with every Reflex override written down, and the
portfolio's lint gate runs it.

## Sources

- Roy Derks, LinkedIn post on a coding-agent skill that stops AI-generated design
  (https://www.linkedin.com/posts/gethackteam_this-coding-agent-skills-stops-every-ai-generated-share-7528002511081721856-McZY/).
  The prompt for this plan: it pointed at Hallmark and framed slop as something to stop while the
  agent works, which is why the check is built for the agent first.
- Hallmark (https://github.com/Nutlope/hallmark). Three ideas came from it: the tier model that
  sorts rules into ones that block, ones that block without a stated reason, and ones that only
  report; the check that renders the page in a browser and reads it against a named list of tells;
  and the fresh-context reviewer, which became the goldfish step at the end of the plan.

## Not in this plan

A GRAIN build skill that tells an agent which tokens and components to reach for before it writes
anything. It is the other half of keeping slop out, the prevention to this plan's detection, and
should be the next plan; the rule list here is a good seed for its "never do" section. Also out:
themes, and a before-and-after check that a redesign kept its links
and handlers. Each of those is its own plan if it is wanted.

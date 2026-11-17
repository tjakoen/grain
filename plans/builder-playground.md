---
id: builder-playground
status: todo
track: framework
depends: [grain-lint]
touches:
  - packages/grain/ai/contract.ts
  - packages/grain/ai/manifest.ts
  - packages/grain/ai/compose.ts
  - packages/grain/ai/compose.test.ts
  - packages/grain-mcp/tools.ts
  - ../tjakoen.github.io/view/pages/grain/builder.html
  - ../tjakoen.github.io/src/ai/builder-canvas.ts
  - ../tjakoen.github.io/src/ai/block-composer.ts
owner: human
---

# Make the GRAIN builder a playground you watch the agent write

The builder at /grain/builder works, and the owner calls it meh. The reason is visible in one
screenshot: asked for "a lede, three stat cards and a signup form", it draws three identical cards
that all say "18 atoms", because the model only picks block names from a list of five and the copy
comes from fixtures. The A2UI playground that CopilotKit published answers the same kind of ask by
writing a whole page, line by line, in a format you can read beside the result. This plan moves the
builder toward that shape without giving up the closed catalog that keeps GRAIN honest.

## What the playground does, and what the builder does today

| | A2UI playground (a2ui.open.bot) | GRAIN builder today |
| --- | --- | --- |
| The ask | One prompt box, four sample chips, Enter builds | One prompt box, a BUILD IT button |
| What the model writes | The whole tree: twelve lines of A2UI Express, one component per line, each with an id and its props, including all the copy and data | A list of block names and an order; copy comes from fixtures |
| What you watch | The code pane fills line by line and the canvas paints as each line lands | Nothing, then the whole page at once |
| Vocabulary | Heading, Stat, Grid, Column, BarChart, PieChart, DataTable, Caption and more | lede, card, callout, stat, form |
| Layout | Nested containers (Column, Grid with columns and gap) | A flat six-column row with full, half or third |
| Reading the result | The same UI shown as Express (2.8k characters) or JSON (3.4k) | A JSON tab of the composition document |
| Design system | Swappable: shadcn, Material or your own, and the page repaints | One, GRAIN's |
| Editing | Ask again, and the agent rewrites | A rail of controls per block, plus three model verbs (remove, span, move) |
| Model | Gemini Flash, hosted | Qwen2.5-0.5B in the browser, which landed 0 of 18 edits when measured on 2026-08-14 |

## Why the current one feels weak

1. **The model is not authoring anything.** It names parts; code fills them. A page arguing that an
   AI builds the page shows an AI that chose from a menu, and the repeated "18 atoms" gives it away.
2. **There is no process to watch.** The playground's best moment, by its own commenters' account,
   is reading the code arrive. The builder has no code pane and no streaming.
3. **The vocabulary is too small to say anything.** Five blocks and three widths cannot express a
   dashboard, a comparison or a form with sections, so every ask converges on the same page.
4. **The rail is the most capable thing on the page, and it is for the human.** The AI's own reach
   (three verbs) is narrower than the person's, which inverts the demo.
5. **The model is too small for the job it would need.** A 0.5B cannot write a twelve-line tree with
   real copy. Any redesign that keeps it as the only author keeps the result above.

## Can GRAIN's contract be the format the agent emits?

Not as it stands. The contract (`ai/contract.ts`) is a vocabulary of verbs on surfaces that already
exist: `block.remove`, `block.span`, `block.move`, `field.set` and the rest. It is the operating half
of A2UI, the half that A2UI calls user actions and data updates. It deliberately has no verb that
adds, and the comment says why: "the model never names a component". A2UI is the other half, a
declarative tree the agent writes to create the surface in the first place.

What GRAIN lacks to serve as that format:

- **A component catalog the agent can write against.** Today the block table lives in the portfolio
  (`src/ai/block-set.ts`), not in GRAIN, and it lists five names with fixed props. GRAIN needs a
  catalog with each component's props, their types and limits, published in the manifest the way
  `ACTIONS` already is.
- **Nesting.** A `Block` is flat with a span. The format needs containers (a column and a grid at
  least) and child ids, as A2UI's adjacency list does.
- **Copy and data as payload.** Props are strings with caps. A stat needs a value and a delta, a
  chart needs rows, a table needs columns. The `PayloadSchema` types (string, number, boolean) would
  need arrays of records.
- **A create verb or message.** Either a `surface.create` message carrying the tree, or an
  `block.add` verb. The no-add rule was a guard for the 0.5B and should be revisited explicitly.
- **A line-oriented wire form.** One component per line, so a stream renders as it arrives and a
  bad line is refused alone rather than sinking the page.

What GRAIN already has that A2UI also needs, and does well: a closed catalog stance, validation at
the door (`validateMove`) with informative rejections, the manifest as the single source the agent
reads, and the MCP server (`grain-mcp`) that exposes it outside the browser. The recommendation is
to add a compose layer beside the verbs, not to bend the verbs into one: **GRAIN Compose**, a small
declarative tree validated by the same door, and to keep `block.*` verbs for editing afterwards.

A second option, worth one spike before choosing: emit A2UI itself and register GRAIN's components
as an A2UI catalog. That buys the renderers and the ecosystem for free and costs GRAIN its own
format. The owner decides this; the plan does not.

## The redesign

Three panes, left to right: the conversation, the code, the page.

1. **Prompt and samples** on the left: the box, four sample asks, and the run history.
2. **The code pane** in the middle, one line per component, filling as the agent writes, each line
   ticked or refused by the door as it lands. A toggle shows the same tree as JSON.
3. **The canvas** on the right paints each component when its line validates. The existing block
   rail moves under the canvas as a per-component inspector, so the human controls stay.
4. **Two authors, named on the page.** A hosted model (behind a key the visitor supplies, or the
   owner's proxy) writes the tree; the 0.5B stays for the edit verbs it can do and for the offline
   case. The page says which one wrote what. No fallback that claims an AI wrote what code wrote.
5. **The masthead follows grain-lint:** headline, then byline, then rule, and no eyebrow. The
   playground's own Heading component carries an eyebrow; GRAIN's catalog will not offer one, and
   grain-lint checks the composed output like any other page.
6. **Theme swap** is a later stage, once GRAIN has a second theme worth swapping to.

## Stages

- [ ] Owner picks: GRAIN Compose or A2UI with a GRAIN catalog.
- [ ] Owner picks the hosted author and how a visitor reaches it (key, proxy, or none on the public
      site).
- [ ] Move the block table from the portfolio into GRAIN as a typed catalog, published in the
      manifest and through `grain-mcp` as a `grain_catalog` tool.
- [ ] Add containers and record-array props; add the create message; validate per line at the door.
- [ ] Build the three-pane builder against the mockup, streaming a scripted tree first so the e2e
      suite covers it without a model.
- [ ] Wire the hosted author; measure it with a builder scenario in `audit:desk`, the way the 0.5B
      was measured.
- [ ] Show it: screenshots or a CRUMB tour before calling it done.

## Open questions

- Does a public portfolio page call a hosted model at all, and who pays for it?
- Is the no-add rule retired, or kept for the 0.5B path only?
- Does the code pane show GRAIN Compose lines to a visitor who has never heard of GRAIN, or a
  plainer outline view by default?

## Sources

- Atai Barkai's LinkedIn post announcing the A2UI playground,
  <https://www.linkedin.com/posts/atai-barkai_we-built-an-a2ui-playground-ask-the-agent-ugcPost-7527800388524171264-FOIp/>:
  the three claims (watch the code line by line, swap design systems, one prompt to add it), and
  the comments, which single out watching the code arrive as the part worth learning from and ask
  what happens when the catalog lacks a component.
- The A2UI playground by CopilotKit, <https://a2ui.open.bot>: the layout, the sample chips, and the
  twelve-line Express answer to "Q3 sales by region as a dashboard" quoted in the table above,
  including its Express and JSON sizes.
- Google's A2UI site and spec, <https://a2ui.org>: the locked catalog ("agents place only components
  you registered"), the Express format, streaming, and declarative data with two-way bindings rather
  than executable code.
- GRAIN's own sources: `packages/grain/ai/contract.ts` (the verbs and the no-add rule),
  `packages/grain-mcp/README.md` (the four tools), and the portfolio's `src/ai/block-set.ts` (the
  five blocks).
- The portfolio's measurement of the 0.5B on the builder, 2026-08-14: zero correct edits in
  eighteen.

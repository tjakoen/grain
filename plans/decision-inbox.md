---
id: decision-inbox
status: todo
owner: ai
touches: [packages/grain/components/organisms/decision-inbox]
---

# Add a decision inbox to GRAIN and PANTRY

Build the reusable decision card as a CSS organism and documented HTML contract in GRAIN. PANTRY renders that contract on its Decisions index and supplies the answer behavior. The owner approved this direction in chat.

## Sources

- [GRAIN rules](../packages/grain/CLAUDE.md)
- [PANTRY rendering](../../pantry/decisions-page.ts)
- [PANTRY answer client](../../pantry/pantry-decisions.js)
- [PANTRY answer contract](../../pantry/answers.ts)
- [GRAIN package exports](../packages/grain/package.json)

## Implementation

Use a decision-inbox root with article cards, heading detail links, native option buttons, and a live status message. Each card has a stable data-surface. GRAIN owns token-based responsive CSS and documentation with examples and accessibility guidance. PANTRY owns data attributes and event handling. Show every listed option for open decisions and keep resolved cards as detail links. Requests with no options use the detail form.

Reuse POST /answers and the pantry-base meta prefix. Send the complete question, file, options, recommendation and unblocks along with the selected choice. Disable the card while pending. On success replace its choices with a saved confirmation, without marking the source Markdown resolved. On failure preserve choices, show the error, and allow retry. Keep context and notes available through the detail link. Persisted answers must be reconciled on index reload using the existing answer log, so a saved choice remains visible. Do not change the detailed form or its paste flow.

PANTRY resolves GRAIN through its installed package. Verify the new component with a temporary local package install for development and restore dependency metadata afterwards. Record any release dependency explicitly.

## Verification

- [ ] Rendering tests cover escaped titles and options, open and resolved cards, empty options, and saved answers.
- [ ] Browser checks cover saving, failure and retry, reload, keyboard navigation and a narrow viewport.
- [ ] Run GRAIN and PANTRY typechecks and tests, inspect the rendered page, and run grain-lint.
- [ ] Save screenshots and a run report, then close the plans.

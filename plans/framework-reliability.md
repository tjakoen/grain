---
id: framework-reliability
status: done
track: framework
depends: []
touches:
  - packages/proof/verify.ts
  - packages/proof/verify.test.ts
  - packages/proof/live.ts
  - packages/proof/live.test.ts
  - packages/proof/serve.ts
  - packages/proof/README.md
  - packages/grain/ai/model.ts
  - packages/grain/ai/model.test.ts
  - packages/grain/ai/model-reasoner.ts
  - packages/grain/ai/model-reasoner.test.ts
owner: ai
---

# Make PROOF verification and shutdown trustworthy

The October 31 audit found that a failed Git comparison could pass verification and an unfinished
watcher rebuild could outlive shutdown. This bounded slice makes those failures explicit and proves
that shutdown drains work before callers remove their files. The next bounded slice makes generic model reasoner execution reject unsupported actions and respect cancellation, and validates model response shapes before execution.

- [x] Add regression cases for failed Git commands and preserve valid empty diffs.
- [x] Serialize watcher rebuilds, report errors, and await active work during shutdown.
- [x] Replace fixed watcher test sleeps with observable completion and cover shutdown races.
- [x] Run focused tests and typechecking, then obtain independent review.

- [x] Reject unsupported generic model actions and validate malformed model properties.
- [x] Respect cancellation before writes, after completion and before late navigation.

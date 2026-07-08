---
id: 001-core-parser
status: done
track: A
depends: []
touches: [proof/core/schema.ts, proof/core/types.ts]
owner: ai
---

# Core plan parser + derived index

The pure heart of PROOF: turn one plan file into a typed `Plan`, and a set of plans into the
derived index. No filesystem, no git, no clock — so it stays trivially testable.

- [x] the Plan model + status/owner vocabularies
- [x] parsePlan: frontmatter to typed fields, body to title + tasks
- [x] buildIndex + validateBoard
- [x] unit tests

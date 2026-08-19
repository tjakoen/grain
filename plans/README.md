# Plans

The plan board for GRAIN, rendered by `pantry serve` and read from these files. The files are the
source of truth; the board only projects them.

One file per plan, `kebab-case.md`, with frontmatter:

```yaml
---
id: matches-the-filename-stem
status: todo | doing | done | blocked
track: which line of work this belongs to
depends: []
touches: []
owner: ai | human
---
```

Update `status` in the same edit as the work it tracks. A finished plan stays here with
`status: done` rather than moving to an archive, so the reasoning stays next to the code it
explains. Never keep a second plan system or a hand-maintained index beside this one.

A plan is claimed before the editing starts, not after, so two sessions do not collide on the same
work and so the trail begins before the diff does. What a run actually did lands in
`../artifacts/runs/`.

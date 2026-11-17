---
id: grain-drift-check
status: todo
track: loop
depends: []
touches:
  - ../pantry/
  - ../../agent-config/shared/tools/
  - packages/grain/UPGRADING.md
owner: human
---

# Let the loop notice when a repo has fallen behind the GRAIN family

The portfolio pins @tjakoen/grain at a caret range, and so does every other repo that consumes a
layer. Nothing tells a session that the range it is building against is three releases old, or what
changed in between, so a repo keeps reimplementing a component the design system already ships.
The owner asked for the loop to check the packages a repo uses and update itself, and for each
implementation to see how it updates through that. This plan says how. It touches PANTRY and
agent-config, so it stays a plan for the owner and nothing in it is built here.

## The check

A doctor row, run by pantry doctor at session start like the existing rows:

1. Read the repo's package.json and lockfile, and collect every @tjakoen/grain, mill, proof and
   crumb dependency with the version the lockfile actually resolved.
2. Ask the npm registry for each package's latest version. Anonymous, no token, as RELEASE.md
   already guarantees. Cache the answer for a day so the row stays under a second.
3. Report one of three verdicts per package: current, behind by patch or minor (warn), or behind
   by a major or by more than a set number of minors (due).

A due row is carried in the run report like every other due row, so drift cannot sit untouched for
three sessions without showing up as a LOOP red flag.

## How an implementation updates through it

Each GRAIN release ships an UPGRADING.md entry, one heading per version, with three parts:

- **What changed**: the components added, renamed or removed, in one line each.
- **What to do**: either "nothing" or a named codemod. A codemod is a small script in the package
  under scripts/upgrade/, named for the version, that rewrites class names or attributes in a
  consumer's markup and prints every file it touched.
- **What to look at**: the catalog anchors a human should open after upgrading.

The doctor row links the entries between the resolved version and the latest. A session that picks
up the row then runs deps:refresh, runs each listed codemod in order, runs the repo's own gate, and
records the upgrade in its run report. A codemod never runs on its own from the doctor; the row only
says which ones exist.

## Steps for the owner

- [ ] Decide the threshold for due (one major, or how many minors).
- [ ] Add the row to pantry doctor, reading the family list from pantry.config.json.
- [ ] Add the same check to agent-config's session checklist for repos without PANTRY.
- [ ] Start packages/grain/UPGRADING.md with this release's entry, and add scripts/upgrade/ when
      the first rename needs a codemod.
- [ ] Teach the publish workflow to fail when a version bump has no UPGRADING.md entry.

## Sources

- Ram Maheshwari, LinkedIn post on a dashboard skill for coding agents
  (https://www.linkedin.com/posts/rammcodes_this-is-straight-up-magic-for-building-beautiful-share-7527972016134598656-01sA/).
  The same post that prompted the dashboard layer; the owner's request to check packages and
  update came alongside it, so it shares the source. Nothing technical was taken from it.
- RELEASE.md in this repo: the anonymous registry reads and the deps:refresh script the check
  relies on.

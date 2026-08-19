# Run reports

Evidence from AI runs in this repo lands here, one file per run.

## Why this directory exists at all

LOOP section 4a is the rule behind it: a run closes with a report, and a claim of "verified" with no
report attached is treated as unverified. The directory comes first, before any check is switched on
in this repo, and that order is deliberate. A doctor that raises flags in a repo with nowhere to
write them down produces findings nobody can close, and a check whose findings nobody can close is a
check people learn to scroll past. Landing place first, checks second.

## What a report is

One file per run, named YYYY-MM-DD-short-slug.md. Frontmatter first, then the prose. PANTRY reads
the frontmatter and renders the ledger at /runs; the body is for the reader. Nothing here is
generated, so a field is only as honest as the run that wrote it.

## The frontmatter

```yaml
---
title: one line, what this run was actually about
date: YYYY-MM-DD
status: complete | partial | abandoned
lane: high | gated | human        # LOOP section 4b, decided before the work, not after
branch: the branch it ran on
skills: [which standards fired]
scope: [the declared envelope, paths or areas]
scopeGrowth: anything touched outside the envelope, and why it was reached rather than drifted into
touched: [what the run actually changed]
dirty: ["path | why it was left uncommitted"]
plans: ["plan-id | href"]
gates: ["the command | its result"]
diffstat: commits, insertions, deletions
unpushed: "N | why they are unpushed"
doctor: what the doctor said at the start, and which flags are carried by name
verifiedBy: who did the second pass, or "nobody yet" said plainly
---
```

The two fields that carry the most weight are the ones easiest to fudge. gates names the command
and its result, and the verbatim output belongs in the body: "tests pass" is a summary, and a summary
is the thing the ledger exists to replace. verifiedBy is the no-grading-your-own-homework rule from
LOOP section 2, and the honest answer is very often "nobody yet", which is worth more than a name
that did not read the diff.

## What the body owes

Gate output pasted verbatim. What was not done, named. What needs human eyes, named. A report that
lists only wins is a report that is hiding something, and the missing "what was not done" section is
the first thing to look for when reading one of these cold.

Where the change touches something a person can look at, the report is not the whole close. A
rendered change also owes a dev tour, one step per surface, each with a verify line the reviewer can
execute. The tour does not satisfy the verification rule, because the session that wrote the change
writes the tour. It only makes the second pass cheaper.

## Reading them

Run the cockpit and open /runs, which parses every file here, shows which reports are missing
evidence, and measures what each run touched against the envelope it declared. Where the cockpit is
not running, the file itself is the handover and the path to it is what goes in chat. Neither
replaces the report: a surface can only render what the run was honest enough to write down.

---
🤖 **Built with Claude, receipts included.** [How I actually work with AI →](https://tjakoen.github.io/notes/ten-times-zero)

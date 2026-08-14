# Narrowing what a screen offers a small model (BUILT 2026-08-15)

> **Status: BUILT 2026-08-15**, commits `4ab5d1b` and `d44bf5a`, both default-on for every screen by
> the owner's call the same day. The five audit scenarios are still five reds, and what changed is
> underneath the count: see "What the number did" at the bottom, which is the part worth reading.
>
> The owner chose narrowing over retuning the portfolio's prompt on
> 2026-08-14, after the live 0.5B failed eighteen of eighteen builder edits and never once targeted a
> block. The measurement lives in `tjakoen.github.io/artifacts/runs/2026-08-14-builder-model-measured.md`
> and the decision in that repo's `plans/builder-design.md`, Open 3. This file is the grain half: who
> consumes the function, what can be cut for free, and the two questions that have to be answered
> before a line of it is written.

## What the model was handed

Fourteen actions and fifty-three targets, seventeen of the targets being chat message ids. The
manifest was correct. It listed `block:b1` through `block:b4` against all three block verbs, so the
right answer was in the list. The model picked a plausible-looking non-block surface out of it
anyway, sixteen times out of eighteen answering `move`, a verb that does not exist, aimed fifteen
times at `builder-rail`, a real surface that accepts nothing.

## Who consumes the function, fleet-wide

Narrowing is a change to `manifestForReasoner` and `manifestToText` in `ai/manifest-dom.ts`, so every
one of these is downstream. The survey is complete: these are all the callers outside `node_modules`
and outside the built `dist/`.

| Caller | Reads | Who is on the other end |
| --- | --- | --- |
| `grain/ai/client-door.ts:55` | `manifestForReasoner(doc)` as the door's `observe` step | whatever reasoner is driving the client door, stub or real |
| `grain/ai/model-reasoner.ts:117` | `manifestToText(m)` into `buildReasonerPrompt` | a real model, through the model reasoner |
| `grain-mcp/tools.ts:93,131` | `domManifest` plus `manifestToText` | a large model, over MCP |
| `grain/scripts/terminal.js:233` | `domManifest` as JSON for the `context` command | a person reading a console |
| `grain/scripts/xray.js:40` | `harvestTargets` plus `targetLabel` | a person looking at the x-ray overlay |
| `tjakoen.github.io/src/ai/builder-canvas.ts:323,325` | `domManifest` for validation, `manifestForReasoner` for the prompt | the 0.5B, on `/builder` |
| `tjakoen.github.io/src/ai/desk-door.ts:149` | `domManifest` only | the desk, for validation rather than a prompt |

Two things fall out of that table. The consumers that would suffer from a narrower manifest are the
MCP tool and the two human-facing scripts, and none of the three goes through `manifestForReasoner`
for a prompt: the scripts read the JSON or the raw targets, and the MCP tool reads both. So a cut
made inside `manifestForReasoner` and `manifestToText` reaches the two prompt paths and the MCP
tool's text field, and leaves the x-ray, the `context` command and both validation paths untouched.

## The cut that costs nothing

Seventeen of the fifty-three targets are chat message ids. A chat message is addressed `chat-msg:...`
and `chat-msg` is not a registered `SurfaceKind`, so `deriveKind` marks it push-only and
`deriveAccepts` returns an empty list. In the prompt text each one renders as its own line ending in
`(no verb currently targets this)`.

A push-only target cannot be a legal move. `validateMove` refuses any target whose accepts list does
not carry the verb, so a model that picks one has already lost the turn. Listing it in the prompt
can only mislead, and removing it from the prompt removes no capability from any reasoner anywhere,
large or small. That is the one narrowing that is free of the judgment call below.

It is worth roughly a third of the target list on `/builder` on its own, and the share will be higher
on any screen where the desk has been talking for a while, because chat messages are the surface
whose count grows without bound.

## The two questions

**Is a narrower manifest wanted on all screens, or only where a small model drives?** This is not in
any file and the handoff was explicit that it is the owner's. The free cut above argues one way: a
target that no verb accepts is noise for a large model too, and making that conditional would be
carrying a flag for no benefit. Everything past it argues the other way, because the next cuts are
real losses. Trimming the fourteen actions to the ones some target on this screen accepts, or letting
a caller name the kinds it cares about, both take capability away from the model driving over MCP,
which is the one consumer that can use the whole vocabulary.

**If the answer is opt-in, who passes the option?** The only caller that would ask for a narrower
manifest is `src/ai/builder-canvas.ts`, which is in the portfolio. This run's cap covers grain's
`ai/` and `plans/` and does not grant a portfolio edit. So an opt-in design cannot be measured
against the five audit scenarios without widening the cap by one file, and a default-on design can.

**Both were answered on 2026-08-15.** Default-on for every screen, on the argument that a target no
verb accepts is noise for a large model too. The portfolio file was granted and then turned out not
to be needed: `node_modules/@tjakoen/grain` in the portfolio is a symlink to this repo, so the
narrowing was live there the moment it was written, with no publish and no version bump.

## What was built

**`4ab5d1b`, the targets.** `manifestToText` lists only targets that accept at least one verb, and
says how many it left out, so the omission is stated rather than hidden. Where nothing was push-only
the string is byte-identical to before, which is the fleet guarantee and has a test of its own. A
page that declares surfaces but has no verbs for any of them says that in its own words instead of
claiming it declares nothing. `domManifest` is untouched, so validation, the x-ray, the terminal's
`context` command and the MCP tool's JSON still see the whole page.

**`d44bf5a`, the state block.** Narrowing the targets moved the failure instead of removing it, and
the new failure named its own cause. With the list cut from 53 to 8, the model stopped answering with
a wrong target and started answering with `builder-said`, an id that is in no targets list at all. It
is in the `in view` block, and the two line shapes were nearly identical: `- id [kind] -> verbs`
against `- id [kind] "text"`. A model told to pick a target from a list found both lists. So the
state block stops competing: no dash, no brackets, indented `id = "text"` entries under a heading
that says in words that these are not targets and no verb acts on them.

## What the number did

Fifteen answers after the change, against the eighteen that established the baseline. Still 0 of 5
scenarios passing, and every other measure moved.

| | before | after |
| --- | --- | --- |
| targets handed over on `/builder` | 53 | 8, four of them blocks |
| answers naming a real block verb | 0 of 18 | 6 of 15 |
| answers aimed at a block | 0 of 18 | 7 of 15 |
| answers aimed at `builder-rail` | 15 of 18 | 0 |
| answers aimed at `builder-said` | 1 of 18 | 0 |
| answers inventing the verb `move` | 16 of 18 | 8 of 15 |
| runaways into a self-nesting payload | 1 of 18 | 2 of 15 |

Five of the fifteen picked a real block verb AND a real block number, which had never happened once.
Every one of those five was refused for the same single reason: the target was `b2` where the
manifest addresses it `block:b2`.

## What blocks the next red turning green

The prefix is not the model's invention. The page's own line under the manifest says "The blocks here
are: b1, b2, b3, b4", built by `blockMessage` in the portfolio's `src/ai/block-reasoner.ts` from the
rail's bare ids, while the manifest three lines above lists `block:b1` through `block:b4`. The two
disagree, and the function's own comment says why the model believes the wrong one: it names the ids
literally because "a 0.5B copies far better than it computes". It copies. It was given the form that
does not resolve.

That is a contradiction this estate authored rather than a limit of the model, and it is one line to
fix. It is also the portfolio's prompt, which is the direction the owner explicitly did not take on
2026-08-14, so it is left here rather than done. It is the strongest lead in the data now, the way
the manifest's length was the strongest lead before it.

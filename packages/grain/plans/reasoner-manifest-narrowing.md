# Narrowing what a screen offers a small model (SURVEY, 2026-08-15)

> **Status: surveyed, not built.** The owner chose narrowing over retuning the portfolio's prompt on
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

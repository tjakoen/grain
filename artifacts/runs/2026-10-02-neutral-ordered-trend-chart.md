---
title: a neutral ordered trend chart is available to GRAIN consumers
date: 2026-10-02
status: complete
lane: high
branch: codex/trend-chart
skills: []
scope: [packages/grain/components/molecules/trend-chart, packages/grain/PLAN.md, packages/grain/package.json, bun.lock]
scopeGrowth: none
touched: [trend-chart CSS, component documentation and conformance tests, package patch version, GRAIN component plan]
dirty: []
plans: ["trend-chart | packages/grain/PLAN.md"]
gates:
  - "Docker GRAIN workspace gate after coordinate fix | 697 pass, 0 fail; typechecks exit 0; lint 0 errors"
  - "Docker component conformance test after coordinate fix | 6 pass, 0 fail"
  - "git diff --check | exit 0"
  - "npm version availability | 0.1.24 returns E404; current published version is 0.1.23"
diffstat: "implementation across original and fixup commits: 6 files changed, 258 insertions(+), 10 deletions(-); original commit 220 insertions(+), 2 deletions(-); fixup 38 insertions(+), 8 deletions(-)"
unpushed: "4 | original code, report, coordinate-fixup, and report-correction commits on codex/trend-chart; publishing and pushing were explicitly excluded"
doctor: "not run; the task required package gates, and no GRAIN doctor command was specified"
verifiedBy: nobody yet
---

## What landed

Commit `ce16afe` adds the public CSS-only component `.trend-chart` under
`packages/grain/components/molecules/trend-chart/`. It presents ordered labels and a series as a
token-colored SVG, then repeats the exact values in an accessible table. Callers provide either
chronological periods or ordered categories, such as story-point sizes. The component treats those
labels as opaque strings. Callers provide the measure, units, plotted coordinates, scale, and any
interpretation. An optional comparison band and table column use the same unit and y scale as the
series. The component supplies no target, score, productivity claim, or positive/negative judgment.

The documentation includes invented example data, the SVG and table contract, the optional-range
case, missing-value behavior, theme and reduced-motion behavior, and the shared GRAIN in-transit
edge. The catalog discovers the component from its colocated `.md`; the package component stylesheet
bundle includes its CSS by walking the components directory. The GRAIN component plan now records
the reusable component. `@tjakoen/grain` and the workspace lock entry move from 0.1.23 to 0.1.24.

## Gate output

The authoritative workspace gate ran with Docker against this isolated worktree using a temporary
Compose override for the GRAIN source mount. The temporary override did not modify the main GRAIN
checkout.

```text
GATE_EXIT=0
@tjakoen/grain check: Exited with code 0
@tjakoen/grain-mcp check: Exited with code 0
@tjakoen/mill check: Exited with code 0
@tjakoen/crumb check: Exited with code 0
@tjakoen/proof check: Exited with code 0
Ran 696 tests across 70 files. [8.53s]
Found 41 warnings and 0 errors.
Finished in 195ms on 151 files with 137 rules using 12 threads.
```

The focused component conformance test ran in the same Docker environment:

```text
COMPONENT_TEST_EXIT=0
(pass) the component gives a chart an equivalent tabular text alternative [0.25ms]
(pass) the data contract requires a visible unit and an optional comparison range [0.10ms]
(pass) chart ink and range use semantic tokens rather than a judgment color [0.09ms]
(pass) the component is static and keeps the reduced-motion contract explicit [0.07ms]
(pass) the shared GRAIN in-transit treatment applies to the component root [0.05ms]
 5 pass
 0 fail
Ran 5 tests across 1 file. [136.00ms]
```

`git diff --check` and `git diff --cached --check` both exited 0. The staged code change reported:

```text
6 files changed, 220 insertions(+), 2 deletions(-)
```

That stat reproduces with `git show --stat --oneline ce16afe`.

The npm registry checks returned:

```text
npm view @tjakoen/grain version
0.1.23

npm view @tjakoen/grain@0.1.24 version
npm error code E404
npm error 404 No match found for version 0.1.24
```

## What was not done

- The package was not pushed, merged, or published. The user’s orchestration instruction reserves
  review and release to the top-level owner.
- Neither People Manager consumer was edited. This worktree is the isolated GRAIN source task.
- No screenshot or browser inspection was performed. The docs and automated component contracts
  were verified, but a rendered visual review remains useful before release.
- The host-side `tsc` command was unavailable, and host-wide tests encountered existing Windows
  path assumptions. The Docker workspace gate above is the repository’s documented authoritative
  environment and passed on the final implementation.

## Coordinate review correction

An independent review found that the first example’s plotted values did not exactly match its table,
and the final category label did not share the plotted point’s x coordinate. Commit `950587f` fixes
all four rows against the documented linear scale, where `y = 20 + (16 - value) × 9.5`. The A–D
labels and all three plotted series now use x coordinates 70, 176, 282, and 388. The points, upper
and lower comparison edges, and the range polygon are derived from the table values with no rounding
error. Group C’s lower bound is 5, and Group D’s lower bound is 6; each now maps to its corresponding
y coordinate.

A new conformance test parses the example’s table and SVG, computes expected coordinates from the
scale, and checks the line, circles, range edges, polygon, and label alignment. It failed during
development when Group C’s lower edge still disagreed with the table, then passed after correction.
The final focused test output is:

```text
COMPONENT_TEST_EXIT=0
(pass) the component gives a chart an equivalent tabular text alternative [0.19ms]
(pass) the data contract requires a visible unit and an optional comparison range [0.12ms]
(pass) the documented SVG points and range map exactly to the accessible table and labels [0.93ms]
(pass) chart ink and range use semantic tokens rather than a judgment color [0.13ms]
(pass) the component is static and keeps the reduced-motion contract explicit [0.12ms]
(pass) the shared GRAIN in-transit treatment applies to the component root [0.07ms]
 6 pass
 0 fail
Ran 6 tests across 1 file. [150.00ms]
```

The complete Docker workspace gate was rerun after the coordinate and test changes:

```text
GATE_EXIT=0
@tjakoen/grain check: Exited with code 0
@tjakoen/grain-mcp check: Exited with code 0
@tjakoen/mill check: Exited with code 0
@tjakoen/crumb check: Exited with code 0
@tjakoen/proof check: Exited with code 0
Ran 697 tests across 70 files. [8.37s]
Found 41 warnings and 0 errors.
Finished in 194ms on 151 files with 137 rules using 12 threads.
```

The initial implementation commit reports `6 files changed, 220 insertions(+), 2 deletions(-)` and the
fixup reports `2 files changed, 38 insertions(+), 8 deletions(-)`. Reproduce each with
`git show --stat --oneline ce16afe` and `git show --stat --oneline 950587f`; their implementation
totals are 258 insertions and 10 deletions across six distinct files.

The original example coordinates described earlier in this report have been superseded by this
correction. The final worktree remains local and unpublished.

## Human review

Please review the public name and contract, especially that ordered labels intentionally carry no
inherent temporal or numeric meaning, and that the caller must keep its SVG and accessible table in
sync. Also review the sample’s neutral comparison band before GRAIN publishes 0.1.24.

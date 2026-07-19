// proof/init.ts — `proof init`: scaffold PROOF into a HOST project.
// Non-invasive by design (see ../PLAN.md piece 4): this writes NEW files only. It never edits
// a host's existing settings.json or CLAUDE.md — those are the host's own files, and editing
// them silently is exactly the "AI maintains the board" anti-pattern the design law forbids
// for plans. Instead it prints the one manual wiring step so a human (or the AI, visibly)
// decides to make it. Idempotent: re-running skips files that already exist unless `force`.
import { mkdir, writeFile, access, chmod } from "node:fs/promises";
import { join } from "node:path";

// ---- scaffolded file contents (template-string constants, named for what they are) --------

// The template plan every host gets on day one. Deliberately teaches the schema by being one:
// a real, valid plan a human can read top to bottom in ten seconds. Must parse cleanly via
// core/schema.ts#parsePlan — verified in init.test.ts, not just asserted here.
const WELCOME_PLAN = `---
id: 000-welcome
status: todo
track:
depends: []
touches: []
owner: ai
---

# Welcome to your plan board

This is a PROOF plan: a markdown file with a small frontmatter block (id, status, track,
depends, touches, owner) followed by prose and a checklist. Files are the source of truth —
the board (\`proof serve\`) only ever renders what's already here, and the AI updates a plan's
\`status\` the moment the work's state changes, the same way it edits any other file it's
already touching.

- [ ] read plans/README.md for the full schema and the one rule
- [ ] replace this file with your project's first real plan
`;

// The contract the AI reads before it writes its first plan. Plain prose per the brief: no
// em-dashes, no backticks (field names spelled out or fenced, never inline-ticked).
const PLANS_README = `# plans/README.md — the PROOF contract

This folder is a PROOF plan board. Each file is one plan: a markdown document with a small
frontmatter block, followed by prose and a task checklist. The board renders these files; it
never stores anything of its own.

## The frontmatter schema

Every plan file starts with a frontmatter block containing exactly these fields.

\`\`\`yaml
---
id: 001-example        # equals the filename stem; the plan's stable address
status: todo            # one of: todo, doing, done, blocked
track: A                # optional; a free grouping label
depends: []              # ids of other plans this one waits on
touches: []              # optional; code paths this plan affects
owner: ai                # one of: ai, human
---
\`\`\`

Field by field:

- id. Equals the filename without the extension. If you set it in frontmatter it must match
  the filename, or nothing that depends on it will resolve.
- status. One of todo, doing, done, or blocked. This is the one field that changes the most,
  and the one rule below is entirely about keeping it honest.
- track. Optional. A short label for grouping related plans; leave it empty if you do not need
  one.
- depends. A list of other plan ids this plan is waiting on. Empty list if none.
- touches. Optional. A list of code paths this plan is expected to affect, used to scope
  related tooling and show blast radius. Empty list if not applicable.
- owner. One of ai or human, marking whose intent the plan represents.

## The one rule

Files are the source of truth. The board is only a projection of what is already on disk.

Update a plan's status the moment the work behind it changes state. Do this in the same file
you are already editing, as part of the work, not as a separate bookkeeping step.

Never hand maintain a board, an index, or a tasks.json alongside these files. Any derived index
is generated from the plan files themselves; a hand edited copy of it is dual bookkeeping and is
not part of this design.

Never build a second plan system next to this one. If this project already tracks plans in
prose somewhere else, migrate that content into plans/ or leave PROOF out entirely.

## Viewing the board

Running proof check lints this folder for schema problems, illegal status values, and plans
that are marked done while their checklist still has open items. A viewer such as pantry, or
proof serve directly, renders these files as a kanban style board for a human to look at. The
board is read only; edit the plan files themselves to change anything.
`;

// SessionStart hook target: print a compact plan index. POSIX sh only (no bashisms) so it
// runs under whatever /bin/sh the host has, matching the "any project" claim in PLAN.md.
const SESSION_START_SH = `#!/bin/sh
# plans/.proof/session-start.sh — prints a compact plan index for a SessionStart hook.
# Cheap session-start context per PLAN.md: id + status + title, no bodies. POSIX sh, no
# bashisms, so it runs on any host regardless of shell.

set -e

dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

echo "PROOF plan board ($dir):"

found=0
for f in "$dir"/*.md; do
  [ -e "$f" ] || continue
  base=$(basename "$f")
  [ "$base" = "README.md" ] && continue
  found=1
  status=$(grep -m1 '^status:' "$f" | sed 's/^status:[[:space:]]*//')
  title=$(grep -m1 '^#[[:space:]]' "$f" | sed 's/^#[[:space:]]*//')
  [ -z "$status" ] && status="(none)"
  [ -z "$title" ] && title="$base"
  echo "  [$status] $title ($base)"
done

if [ "$found" -eq 0 ]; then
  echo "  (no plans yet — see plans/README.md)"
fi
`;

// pre-commit hook target: a soft nudge, never a blocker. Warns if a plan claims "doing" but
// no plans/ file is staged — a signal the board and the commit have drifted apart, without
// ever stopping a commit (the enforcement ladder says hooks, not a hard gate, for this rung).
const PRE_COMMIT_SH = `#!/bin/sh
# plans/.proof/pre-commit.sh — warns (never blocks) when a "doing" plan wasn't touched.
# Non-blocking by design: this is a nudge, not a gate. Always exits 0.

set -e

dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

has_doing=0
for f in "$dir"/*.md; do
  [ -e "$f" ] || continue
  base=$(basename "$f")
  [ "$base" = "README.md" ] && continue
  if grep -q '^status:[[:space:]]*doing' "$f" 2>/dev/null; then
    has_doing=1
    break
  fi
done

if [ "$has_doing" -eq 1 ]; then
  staged=$(git diff --cached --name-only 2>/dev/null | grep '^plans/' || true)
  if [ -z "$staged" ]; then
    echo "warning: a plan is marked 'doing' but no file under plans/ is staged in this commit" >&2
    echo "         (update the plan's status, or note why not, before it goes stale)" >&2
  fi
fi

exit 0
`;

// ---- runInit -----------------------------------------------------------------------------

export interface InitResult {
  created: string[];
  skipped: string[];
  instructions: string;
}

// Each scaffolded file, relative to targetDir, with its contents and (for the two shell
// scripts) whether it needs the executable bit so a host can wire it as a hook directly.
interface ScaffoldFile {
  relPath: string;
  contents: string;
  mode?: number; // POSIX file mode; only set for files that must be executable
}

const SCAFFOLD_FILES: ScaffoldFile[] = [
  { relPath: join("plans", "000-welcome.md"), contents: WELCOME_PLAN },
  { relPath: join("plans", "README.md"), contents: PLANS_README },
  { relPath: join("plans", ".proof", "session-start.sh"), contents: SESSION_START_SH, mode: 0o755 },
  { relPath: join("plans", ".proof", "pre-commit.sh"), contents: PRE_COMMIT_SH, mode: 0o755 },
];

// The one manual step this never performs itself: a pointer line in the host's CLAUDE.md, and
// (optionally) wiring the two hooks. Printed, not applied — init must never edit a host's
// existing settings.json or CLAUDE.md.
function buildInstructions(): string {
  return `PROOF scaffold written. One manual step remains (init never edits your files for you):

1. Add a pointer line to your CLAUDE.md so the AI knows the board exists, e.g.:

     Plans live in plans/ — see plans/README.md; update a plan's status when its state changes.

2. (Optional) Wire the two hooks for enforcement instead of just instructions:

   a. SessionStart — inject the plan index into context. Add to .claude/settings.json:

     {
       "hooks": {
         "SessionStart": [
           { "hooks": [ { "type": "command", "command": "sh plans/.proof/session-start.sh" } ] }
         ]
       }
     }

   b. pre-commit — warn (never block) when a "doing" plan wasn't touched:

     ln -s ../../plans/.proof/pre-commit.sh .git/hooks/pre-commit

Both hooks are additive and non-blocking; skip either if you'd rather rely on the human glance.`;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// Scaffold PROOF into targetDir. Creates each file only if missing (idempotent); pass
// force:true to overwrite. Never touches anything outside the four scaffold files above —
// in particular never the host's own settings.json or CLAUDE.md.
export async function runInit(targetDir: string, opts?: { force?: boolean }): Promise<InitResult> {
  const force = opts?.force ?? false;
  const created: string[] = [];
  const skipped: string[] = [];

  for (const file of SCAFFOLD_FILES) {
    const fullPath = join(targetDir, file.relPath);
    const already = await exists(fullPath);

    if (already && !force) {
      skipped.push(file.relPath);
      continue;
    }

    await mkdir(join(fullPath, ".."), { recursive: true });
    await writeFile(fullPath, file.contents, "utf8");
    if (file.mode !== undefined) {
      await chmod(fullPath, file.mode);
    }
    created.push(file.relPath);
  }

  return { created, skipped, instructions: buildInstructions() };
}

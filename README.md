# GRAIN — usage

GRAIN is the **AI-interaction design system**: a UI where every surface is addressable
and operable by both a human and an AI through one shared vocabulary, with the AI's
presence shown as a visible signal (*grain = AI*). It runs on a **substrate** (BATCH is
the reference one) but imports nothing from it.

- **Overview / why:** [`../docs/GRAIN.md`](../docs/GRAIN.md)
- **The full contract** (intent envelope, render ops, manifest, the AI-acts protocol,
  the two write paths): [`../docs/AI-INTERFACE.md`](../docs/AI-INTERFACE.md)

This file is the practical reference: what a host must provide, the markup conventions,
and how to wire it.

---

## 1. The substrate contract — what a host must provide

GRAIN is portable to any host that supplies three things:

1. **An `OpChannel`** — `push(session, event, data)` (`ai/contract.ts`). How render ops
   reach a client. BATCH = SSE; a WebSocket hub would do. GRAIN imports the *interface*
   from its own contract, never the implementation.
2. **A renderer that understands the binding vocabulary** below (§3). BATCH's
   composition engine implements it; another substrate must too.
3. **A filesystem** (`ai/accepts.ts` reads component files to harvest the manifest) —
   any JS runtime, not substrate-specific.

Everything else (the scoped write capability, "render a surface to HTML") is **injected**
by the composition root — GRAIN names no concrete dependency.

---

## 2. GRAIN's own conventions (read by the dispatcher + harvest)

Put these on your components/markup; GRAIN's island + door act on them:

| Attribute | On | Means |
|---|---|---|
| `data-surface="kind:id"` | any region | its **address** — what render ops target (built with `surface(kind, id)`) |
| `data-action="verb"` | a control | clicking it (or Enter in an input) becomes `POST /intent` with that verb |
| `data-target="surface"` | a control | the surface the action affects (defaults to the nearest `data-surface`) |
| `data-kind` + `data-accepts="v1 v2"` | a component root | harvested into the AI manifest (what verbs this kind accepts) |
| `data-grade="grain\|smooth\|accent"` · `.is-ai` | any ancestor | provenance: grain = AI, smooth = human (distributed via `--type-font`) |
| `data-commit="pending"` | any ancestor | in-transit / not-yet-committed → reads grain |

The verbs themselves live in the closed registry (`ai/contract.ts`: `ActionName` /
`SurfaceKind` / `ACTIONS`) — the single source of truth.

---

## 3. The binding vocabulary GRAIN's components are authored in

These are the host-renderer conventions (BATCH defines them in `../batch/render/render.ts`).
A substrate must interpret them to render GRAIN's `b-*` atoms. This is the one coupling
that lives in markup rather than code.

| Form | Means |
|---|---|
| `data-field="path"` | set this element's **text** from a data path (HTML-escaped); `"."` = the scope itself |
| `data-bind-<attr>="path"` | set **attribute** `<attr>` from a data path; empty → omit; URL attrs are scheme-guarded |
| `<slot-tag prop-as="default" prop-attr-X="prop" prop-text="prop">` | the **polymorphic** element: become `as`; set attrs/text from config props |
| `each="path"` | **repeat** the component once per array item (item = the scope) |
| `data="path"` | **scope** a child component to a sub-slice |
| `<b-button>` … (hyphenated tag) | a **component** — expanded server-side; may self-close |

Example (GRAIN's text atom):
```html
<slot-tag prop-as="span" prop-attr-class="class" data-field=".">Example text</slot-tag>
```

---

## 4. The grade token slots a host must define

GRAIN's mechanism (`styles/grain.css`) ships **no values** — it reads token *slots* the
consuming theme defines (e.g. in the project's `variables.css`):

- **fonts:** `--type-font` (the inherited switch), `--font-grain`, `--font-smooth`, `--font-accent`
- **ink/paper:** `--ink`, `--paper`, `--color-fg`, `--color-muted`, `--line-soft`
- **scale:** `--space-1..8`, `--text-sm`, `--border`, `--radius-sm`, `--radius-md`

Pick any palette/typeface; *Department of Time* (the reference product) uses monochrome
paper/ink + self-hosted Redaction grades.

---

## 5. Wiring it (composition root)

```ts
import { createInteractionLayer } from "grain/ai/interaction-layer.ts";
import { createAccepts } from "grain/ai/accepts.ts";

const layer = createInteractionLayer({
  reasoner,                       // your Model-backed reasoner (or the stub)
  stream,                         // an OpChannel (e.g. BATCH's createStream())
  archiveItem,                    // app-scoped write capabilities the reasoner may use…
  renderSurface,                  // …and "render this surface to committed HTML"
});
// mount: POST /intent → layer.handleIntent ; GET /stream → the channel ;
//        GET /ai/manifest → buildManifest(screen, targets) ;
// include the island: <script src="/scripts/ai-dispatch.js" defer></script>
// bundle styles/grain.css into your component CSS so the mechanism ships.
```

> **Rough edge (honest):** the action *vocabulary values* and the reasoner's *tools*
> (`archiveItem` …) are currently entangled with GRAIN rather than fully app-injected.
> Pushing the vocabulary down to the consumer is a known next step (see
> `../docs/AI-INTERFACE.md` §1b note). Until then, edit `ai/contract.ts` to add verbs.

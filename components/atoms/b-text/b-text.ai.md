# Typography

Machine-made text reads in the **grain** grade (Redaction 50) — the texture says
"machine-made". The grain is built into the font (a family swap), not faked. Streaming
AI output types in at grain with a caret; when it finishes the caret goes but the text
**stays grain** — grain = AI, so provenance persists (it doesn't masquerade as human).

## Grain — AI / in-transit

### Body
```html
<p class="t">On it — checking your week. You have room on Thursday.</p>
```

### Streaming (caret)
```html
<p class="t"><span>Noted: deep-work moved to Thursday</span><span class="caret"></span></p>
```

### Accent — display only
```html
<p class="t" data-grade="accent">Bread</p>
```

> **Provenance is set by an ancestor, never stamped on the text.** Clean is the
> default (set nothing); grain comes from a state class on a container — `.is-ai` or
> `data-commit="pending"` — which the whole subtree inherits. To compare human vs. AI
> here, just flip the **Human / AI** toggle above: the same component re-grades. You
> never hand-write `data-grade` on a `<p>` in real markup.

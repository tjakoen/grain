# Action badge

One step of the AI's work, shown as its **action verb** — the closed verb vocabulary
(`grain/ai/contract.ts`) made visible. The AI narrates a run as a stream of these
(`reads → types → revises → clicks → commits`). It's AI by nature, so it always wears the
grain "terminal" edge; `status` carries the step's state.

`verb` sets the label; `status="active"` marks the step the AI is doing right now.

## States

### Doing it now (active)
```html
<action-badge verb="clicks" status="active"></action-badge>
```

### Done (settled)
```html
<action-badge verb="reads"></action-badge>
<action-badge verb="types"></action-badge>
<action-badge verb="revises"></action-badge>
<action-badge verb="commits"></action-badge>
```

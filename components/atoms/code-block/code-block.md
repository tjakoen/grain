# Code block

A monospace block for fenced code — plus a `.code-inline` run for inline code. It reads the
`--font-mono` token, so code stays mono in **either** grade; the AI signal here is the dashed
edge (non-text grain), not a font swap. CSS-only: composed by hand (by MILL), nothing data-binds
it, so there is no template. Long lines scroll rather than break the column.

## Block

### Plain
```html
<pre class="code-block"><code>bun run dev</code></pre>
```

### With a language tag
```html
<pre class="code-block" data-lang="ts"><code>export const answer = 42;</code></pre>
```

## Inline
```html
<p>Run <code class="code-inline">bun run check</code> before you call it done.</p>
```

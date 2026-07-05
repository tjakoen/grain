# file-tree

An EXPLORER file tree for the editor-workspace metaphor: folders are native
`<details class="file-tree__dir">` / `<summary>` (zero-JS collapse — ship them **collapsed**, no
`open` attribute; an island may open the current page's ancestors), files are real `<a
class="file-tree__file">` links, so the whole tree navigates as plain hypermedia. Mono type,
hairline indent guides, a rotating chevron. A layout class, not a data-bound tag.

**Honesty contract (consumer's job):** every entry should name a REAL source file and link to the
page that file produces — an invented filename in the tree is a lie in the UI. What maps to what
is the consumer's knowledge; this component only draws it.

```html
<nav class="file-tree" aria-label="Explorer">
  <details class="file-tree__dir">
    <summary>tjakoen.github.io/</summary>
    <div class="file-tree__children">
      <details class="file-tree__dir">
        <summary><a href="/notes">notes/</a></summary>   <!-- a collection folder may link its index -->
        <div class="file-tree__children">
          <a class="file-tree__file" href="/notes/ten-times-zero">ten-times-zero.md</a>
        </div>
      </details>
      <a class="file-tree__file" href="/" aria-current="page">pages/index.html</a>
    </div>
  </details>
</nav>
```

Parent-context notes (lesson 3 — say it here, don't let it fail silently):
- In the app-shell rail, put `data-variant="explorer"` on the `.side-rail` — the tree brings its
  own indent guides, so the variant drops the rail's icon-gutter hairline.
- A collapsed rail (`data-rail-collapsed="true"`) hides the tree entirely (labels ARE the tree).
- Mark the open file with `aria-current="page"` (an island or the server); folders don't get it.

Pairs with `tab-bar`/`tab` + `scripts/tabs.js` (open-pages strip): give the tree
`data-tab-source` and the strip labels its tabs from the tree's link texts.

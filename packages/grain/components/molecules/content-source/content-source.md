# Content source

The Rendered/Source toggle on a MILL entry page: "the site is its own source tree" made
clickable. Composed from the `tab` atom (reuse, not a new control) — Rendered carries
`aria-current="page"`, Source links straight to the entry's raw `.md` route (MILL's
honest-source route, `${prefix}/${slug}.md`).

```html
<nav class="content-source" aria-label="View">
  <a class="tab" aria-current="page" href="/notes/the-browser-grew-up">Rendered</a>
  <a class="tab" href="/notes/the-browser-grew-up.md">Source</a>
</nav>
```

# Typography

One polymorphic type atom — `<b-text as="…">` renders text in any element. Every type
primitive reads the inherited `--type-font` switch and knows nothing about grades, so a
single ancestor state flips a whole subtree between **clean** (human / committed) and
**grain** (AI / in-transit). Toggle to **AI** above to see this component in grain.

## Clean — human / committed

### Body
```html
<p class="t">The desk records what you decided, in your own clean hand.</p>
```

### Display heading
```html
<h1 class="t masthead">A desk that writes back.</h1>
```

### Section heading
```html
<h2 class="t">Overview</h2>
```

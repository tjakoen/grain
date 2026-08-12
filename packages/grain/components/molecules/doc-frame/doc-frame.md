# Doc frame

A document rendered **inside** the page instead of replacing it. Point a route at one and a PDF
becomes an ordinary page, which makes it an ordinary open tab (`scripts/tabs.js` projects visited
paths), which means the reader can close it and still be where they were. A bare link to a `.pdf`
hands the tab to the browser's viewer and the site is gone, chrome and all.

Composed by hand, so nothing data-binds it. **Same-origin documents only.** This is for files the
site itself serves; it is not a hole for third-party embeds.

`<object>` rather than `<iframe>` for one reason: a browser that cannot render the type inline
renders the element's **children** instead, so the fallback is markup and not a script sniffing for
support.

## Doc frame
```html
<figure class="doc-frame">
  <object class="doc-frame__object" data="/assets/doc-sample.pdf" type="application/pdf"
          aria-label="Sample document, rendered in the page">
    <p class="doc-frame__fallback">
      This browser will not display the document inline. Open it directly instead.
    </p>
  </object>
  <figcaption class="doc-frame__escape">
    <a href="/assets/doc-sample.pdf">Open the file directly</a>
    <span>1 page · 753 bytes</span>
  </figcaption>
</figure>
```

## The escape hatch is not optional

The `<figcaption>` link is **not** redundant with the `<object>` fallback, and this is the part worth
remembering when a future change makes it look like clutter: **iOS Safari neither renders a
multi-page PDF inline nor triggers the fallback.** It draws page one in a dead box and stops. Nothing
in the markup can detect that, so the direct link stays visible for everybody rather than being
hidden behind a fallback that never fires.

## Height

`--doc-frame-height` (default `max(28rem, 78vh)`) sets the box, because a slide deck and a
two-column paper want different ones. Set it on the `.doc-frame`.

```html
<figure class="doc-frame" style="--doc-frame-height: 32rem;">
  <object class="doc-frame__object" data="/assets/doc-sample.pdf" type="application/pdf"
          aria-label="Sample document in a shorter frame">
    <p class="doc-frame__fallback">This browser will not display the document inline.</p>
  </object>
</figure>
```

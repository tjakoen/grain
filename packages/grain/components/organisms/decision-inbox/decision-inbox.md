# Decision inbox

A list of questions with their available choices beside them. Each card keeps a detail link for the context, evidence and notes that need more room. The host records the answer and confirms the chosen words in the card.

This is a CSS-only organism. It has no parent layout requirement and uses the semantic palette tokens. Options wrap inside narrow panes. There is no animation, so reduced motion has no additional behavior.

## Example

```html
<section class="decision-inbox" aria-label="Open decisions">
  <article class="decision-inbox__card" data-surface="decision-storage">
    <h3 class="decision-inbox__title"><a href="#storage">Where should the draft live?</a></h3>
    <div class="decision-inbox__options">
      <button type="button" data-recommended="true">In the repository (recommended)</button>
      <button type="button">In a shared document</button>
    </div>
    <p class="decision-inbox__status" role="status"></p>
  </article>
</section>
```

## Host behavior

The host owns the event handler and persistence. Disable every choice in the affected card while saving and set its pending commit attribute. A confirmed answer leaves the choices disabled and shows the saved choice in the status region. Move focus to the detail link if the focused choice becomes disabled. On failure, restore the choices and give a retry message. Clear the pending attribute on every exit.

Restore saved answers from durable state on reload. Match the question snapshot as well as its identifier, so an edited question can be answered again. Keep the detail link available when a question has no discrete options or the answer log cannot be read. Saving an answer and resolving the underlying request are separate host operations.

## Accessibility

Use native buttons and links. Give the containing section an accessible name and each card a stable surface address. Keep the live status region in the DOM before saving begins. The recommendation is visible text as well as a stronger border. Keyboard users reach the detail link and each available choice in document order. With JavaScript unavailable, the detail link remains usable.

The interaction was informed by AffectUI's Decision Inbox. This implementation uses GRAIN's HTML and CSS contract.

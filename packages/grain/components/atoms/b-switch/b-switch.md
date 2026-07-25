# Switch

A labelled on/off toggle built on a real `<input type="checkbox">`, so it keeps
native focus, Space to toggle, and form semantics. The checkbox is visually
hidden but still focusable; the track and thumb are the drawn control. Use it
where an action is a **state the user sets** (delivered / held, locked / open),
not a one-shot verb - a button reading "PUBLISHING" that un-publishes on click
is the anti-pattern this replaces.

Monochrome by default; ON reaches the accent hue (the one place a toggle earns
color, matching `nav-item[aria-current]` and tabs).

## States

### Off
```html
<label class="switch">
  <input type="checkbox" class="switch__input">
  <span class="switch__track"><span class="switch__thumb"></span></span>
  <span class="switch__label switch__label--off">Not delivered</span>
</label>
```

### On
```html
<label class="switch">
  <input type="checkbox" class="switch__input" checked>
  <span class="switch__track"><span class="switch__thumb"></span></span>
  <span class="switch__label">Delivered</span>
</label>
```

### Disabled
```html
<label class="switch">
  <input type="checkbox" class="switch__input" checked disabled>
  <span class="switch__track"><span class="switch__thumb"></span></span>
  <span class="switch__label">Delivered</span>
</label>
```

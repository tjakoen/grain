# Button

One class — `.btn`. Variant, size, and status are attributes, not extra classes.
Pseudo-states are forced for display with `data-force`.

## States

### Default
```html
<button class="btn">Button</button>
```

### Hover
```html
<button class="btn" data-force="hover">Button</button>
```

### Focus
```html
<button class="btn" data-force="focus">Button</button>
```

### Active
```html
<button class="btn" data-force="active">Button</button>
```

### Disabled
```html
<button class="btn" disabled>Button</button>
```

## Sizes

### Small
```html
<button class="btn" data-size="sm">Small</button>
```

### Medium
```html
<button class="btn">Medium</button>
```

### Large
```html
<button class="btn" data-size="lg">Large</button>
```

## Variants

### Solid
```html
<button class="btn">Solid</button>
```

### Soft
```html
<button class="btn" data-variant="soft">Soft</button>
```

### Outline
```html
<button class="btn" data-variant="outline">Outline</button>
```

## Status

### Success
```html
<button class="btn" data-status="success">Save</button>
```

### Danger
```html
<button class="btn" data-status="danger">Delete</button>
```

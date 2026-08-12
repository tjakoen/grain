# Option (from data)

One `<option>`, bound from data. **Parent context required:** it is only meaningful inside
[Choice](../b-choice/b-choice.md), whose template nests `<b-option each="options">` inside the
select. On its own it renders stray text, which is why the example below is shown as source rather
than live.

Data: `value`, `label`, and `selected` bound as the string `"selected"` when that option is the
current one. Any other value, including an empty string, drops the attribute.

```html flat
<option value="hiring" selected="selected">Hiring</option>
```

---
"@smoove/core": patch
---

Add `Text.getText()`, the read side of `setText()`. It returns the full content you set, even while an ellipsis trims the line or a typewriter is halfway through, so a test can check a counter or a caption without reaching into private fields.

```ts
counter.setText("45,999");
counter.getText(); // "45,999"
```

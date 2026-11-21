---
"@smoove/vite": patch
---

`?comp-url` modules now load their video, audio, images and fonts from separate hashed files in the build's assets folder, instead of carrying them inline as base64. Modules are smaller, media caches on its own, and video can stream with byte-range requests. A new `compAssetBase` option points those files at another origin, such as a storage bucket that mirrors the assets folder:

```ts
smoove({ compAssetBase: "https://media.example.com" });
```

---
"@smoove/editor": minor
---

Author compositions, not just inspect them.

The editor now works against a real, filesystem-backed project — `ProjectFs` — which is the source of its own composition list, separate from the studio's demo registry. New write tools (`readFile`, `writeFile`, `editFile`, `scaffoldComposition`, `typecheck`) sit alongside the read tools in `getDefaultSmooveEditorTools()`, and each is also exported as a plain function you can call without an LLM. The default system prompt now carries a distilled smoove-video guide, so the agent writes idiomatic `Composition`/`Sequence`/`interpolate` code.

**Breaking:** `setupAi({ registry })` is now `setupAi({ project })`, taking a `ProjectFs` instead of a studio `Registry`. `EditorToolContext` changes to match, and `listCompositions` returns `CompositionMeta[]` (from the project's `meta.json` files) instead of registry entries.

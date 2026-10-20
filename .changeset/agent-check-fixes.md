---
"@smoove/core": patch
"@smoove/agent": patch
"@smoove/studio": patch
"@smoove/vite": patch
"@smoove/cli": patch
---

Fixes from building a 30-second explainer in a fresh studio project.

- `npx smoove agent check` no longer fails with "Maximum update depth exceeded" on a long composition. The contrast sweep drove the studio's React views through every sample; the studio now holds them while a check, snapshot or sheet draws frames, and they catch up once afterwards.
- `appearsBy(selector, at)` passes when every match has been visible on some frame up to `at`, so a caption that fades out before `beats.hook.end` still counts. When a shared selector has a match that comes later, the finding says so and suggests a name of its own.
- The contrast check leaves a Text that's partway through a fade for the frames where it holds, so a fade in or out no longer needs an allow entry.
- A contact sheet's tile for a beat is two thirds of the way from its settled frame to its last frame before the next beat, instead of that last frame, so a scene that fades out shows up whole. Beats gain `heldTo`, the last frame of that held stretch, which the checks use as before.
- After a hot reload that changes a composition's props schema, the studio fits the props someone edited to the new schema: dropped keys go, new keys get their defaults, and edits to keys that stay are kept.
- `smoove test` hands its arguments to Vitest (`smoove test compositions/intro -t checks --reporter=default`), and a test gets a minute by default, so a check sweep over a long composition doesn't time out.

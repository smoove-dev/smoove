/**
 * Resolve a Vite-imported media URL to something the current runtime can read.
 *
 * The same composition module runs in two places:
 *  - the browser preview, where `<km-player>` plays the Vite-served URL directly
 *    (e.g. `/src/files/film/s1a.mp4` in dev, `/assets/s1a-<hash>.mp4` in a build);
 *  - the Node renderer (`@konva-motion/studio/server`), where ffmpeg needs an
 *    absolute FILESYSTEM path, not a URL.
 *
 * `Video` discards its `src` after loading and `Audio` records its path at
 * construction, so this must run synchronously where `new Video`/`new Audio` is
 * built — wrap every media `src` with it. We detect "rendering" via the global
 * flag `setupServerRendering()` sets (it runs before the composition is built),
 * and deliberately avoid importing any `node:*` module so this stays safe in the
 * client bundle (the Node branch only touches `process` at runtime).
 */
const RENDERING_FLAG = "__KONVA_MOTION_RENDERING__";

export function mediaSrc(url: string): string {
  const g = globalThis as { [RENDERING_FLAG]?: boolean; process?: { cwd?: () => string } };
  // Browser / preview: the Vite URL is directly playable.
  if (!g[RENDERING_FLAG]) return url;
  // Node render: map the URL back to a file under the demo's working directory.
  // dev → assets are served from source: `/src/files/...` → `<cwd>/src/files/...`.
  // build → hashed into `build/client/assets/...`.
  const root = g.process?.cwd?.() ?? "";
  const base = url.startsWith("/assets/") ? "/build/client" : "";
  return `${root}${base}${url}`;
}

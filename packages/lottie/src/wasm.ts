import { DotLottie } from "@lottiefiles/dotlottie-web";

let configuredUrl: string | null = null;
let applied: Promise<void> | null = null;

/**
 * Point the Lottie engine at a specific `dotlottie-player.wasm`.
 *
 * The browser default is the library's own CDN, which needs no setup. To
 * self-host, import the wasm through your bundler and hand over the URL:
 *
 * ```ts
 * import wasmUrl from "@lottiefiles/dotlottie-web/dotlottie-player.wasm?url";
 * setLottieWasmUrl(wasmUrl);
 * ```
 *
 * Call before constructing any `Lottie` node — the WASM instance is shared
 * process-wide and resolved once.
 */
export function setLottieWasmUrl(url: string): void {
  configuredUrl = url;
  applied = null;
}

/**
 * Resolve the wasm in Node as a `data:` URL.
 *
 * Node's `fetch` rejects `file://`, and dotlottie-web reacts by silently
 * falling back to unpkg — which turns every headless render into a network
 * call, and breaks entirely offline. Inlining the bytes avoids both.
 *
 * The specifiers are held in variables so bundlers cannot statically follow
 * them into a browser build. A bare `"module"` specifier is what broke effects
 * in server renders before (see the guard in `packages/renderer/src/gl-node.ts`).
 */
async function nodeWasmDataUrl(): Promise<string | null> {
  try {
    const moduleSpecifier = "node:module";
    const fsSpecifier = "node:fs/promises";
    const { createRequire } = await import(/* @vite-ignore */ moduleSpecifier);
    const { readFile } = await import(/* @vite-ignore */ fsSpecifier);
    const require = createRequire(import.meta.url);
    const path = require.resolve("@lottiefiles/dotlottie-web/dotlottie-player.wasm");
    const bytes = await readFile(path);
    return `data:application/wasm;base64,${bytes.toString("base64")}`;
  } catch (err) {
    console.warn("[smoove] Could not inline the Lottie wasm; falling back to the CDN.", err);
    return null;
  }
}

/**
 * Read `process` off `globalThis` rather than as a bare global: this package
 * has no `@types/node` (and should not need it — it is browser-first), and
 * core reaches for runtime globals the same way.
 */
function isNodeLike(): boolean {
  const proc = (globalThis as { process?: { versions?: { node?: string } } }).process;
  return proc?.versions?.node !== undefined && typeof window === "undefined";
}

/**
 * Apply the WASM URL exactly once per process. Safe to await from every node;
 * concurrent callers share the same promise.
 */
export function ensureLottieWasm(): Promise<void> {
  if (applied) return applied;
  applied = (async () => {
    if (configuredUrl) {
      DotLottie.setWasmUrl(configuredUrl);
      return;
    }
    if (!isNodeLike()) return; // Browser: the library's CDN default is fine.
    const url = await nodeWasmDataUrl();
    if (url) DotLottie.setWasmUrl(url);
  })();
  return applied;
}

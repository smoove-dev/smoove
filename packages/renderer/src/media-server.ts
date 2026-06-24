import { registerMediabunnyServer } from "@mediabunny/server";

let registered = false;

/**
 * Register Mediabunny's server backend (node-av → FFmpeg C API) so the same
 * WebCodecs-based `Input`/`Output`/sink/source classes that run in the browser
 * work in Node. Idempotent — `setupServerRendering()` calls it for you.
 */
export function registerServerMedia(): void {
  if (registered) return;
  registerMediabunnyServer();
  registered = true;
}

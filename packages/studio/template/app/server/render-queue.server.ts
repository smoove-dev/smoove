import config from "virtual:smoove/config";
import type { RenderQueue } from "@smoove/studio/server";

let queue: Promise<RenderQueue> | null = null;

/**
 * The process-wide render queue, or null when `smoove.config.ts` turns
 * rendering off. The `.server` suffix keeps this module out of the client
 * bundle. The renderer loads on the first render, so a studio that never
 * renders never pays for it. The resource routes under `routes/api.render.*`
 * are the only callers; they own all the HTTP.
 */
export function renderQueue(): Promise<RenderQueue> | null {
  if (!config.render) return null;
  queue ??= Promise.all([import("@smoove/studio/server"), import("./resolve.js")]).then(
    ([{ createRenderQueue, createTempStorage }, { resolve }]) =>
      createRenderQueue({ resolve, storage: createTempStorage() }),
  );
  return queue;
}

/** What the render routes answer when rendering is off. */
export function renderOff(): Response {
  return new Response("Rendering is turned off in smoove.config.ts.", { status: 404 });
}

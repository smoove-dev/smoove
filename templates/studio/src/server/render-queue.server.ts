import { createRenderQueue, createTempStorage } from "@smoove/studio/server";
import { resolve } from "./resolve.js";

/**
 * The process-wide render queue. The `.server` suffix keeps this module (and its
 * Node-only imports) out of the client bundle. The resource routes under
 * `routes/api.render.*` are the only callers — they own all the HTTP; this file
 * owns the queue + storage wiring and nothing else.
 */
export const queue = createRenderQueue({
  resolve,
  storage: createTempStorage(),
});

// Server-side render kit for @konva-motion/studio. Node-only (imports
// @konva-motion/renderer + node:*). Contracts + mappers + an in-memory queue —
// NO HTTP. A host wires the transport (see the demo's resource routes).

export { createRenderQueue } from "./render-queue.js";
export type { CreateRenderQueueOptions, RenderQueue } from "./render-queue.js";

export { createTempStorage } from "./temp-storage.js";

export {
  qualityPreset,
  stillMeta,
  toRenderOptions,
  toStillOptions,
  videoMeta,
} from "./map.js";

export type { RenderQueueJob, RenderStorage, StoredArtifact } from "./types.js";

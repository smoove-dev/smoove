import { setupServerRendering } from "@konva-motion/renderer";
import type { RenderRequest } from "@konva-motion/studio";
import registry from "../registry.js";

// Put the engine in rendering mode BEFORE any composition is built. The registry
// entries are lazy (`() => import("./composition.js")`), so importing the
// registry above builds nothing — the composition module only evaluates on
// `registry.load(id)` below, by which point this flag is set and the engine
// wires up the Node video/audio/image factories.
setupServerRendering();

/**
 * Map a render request → the rendering-mode Composition for its id, with the
 * request's props applied. Uses the SAME registry the frontend uses, so the
 * server renders exactly what the studio previews.
 *
 * The registry memoizes one instance per id; a render mutates frame state, so
 * the queue runs jobs serially (concurrency 1) to keep that instance safe.
 */
export async function resolve(req: RenderRequest) {
  const comp = await registry.load(req.id);
  if (req.props) comp.setProps(req.props);
  return comp;
}

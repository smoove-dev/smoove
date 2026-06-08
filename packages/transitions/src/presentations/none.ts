import type { Presentation } from "../types.js";

/**
 * Hard cut — no visual transform. The incoming layer (on top) simply replaces
 * the outgoing one for the overlap window. Useful for driving custom effects
 * off the timing alone. Mirrors Remotion's `none`.
 */
export function none(): Presentation {
  return {
    enter() {},
    exit() {},
  };
}

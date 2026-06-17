/**
 * Standalone (`<script>` tag) entry. Bundles everything and exposes the
 * authoring vocabulary on the global object so a page with no bundler can
 * build a Composition and hand it to `<km-player>`:
 *
 * ```html
 * <link rel="stylesheet" href="player.css" />
 * <script src="player.global.js"></script>
 * <km-player controls></km-player>
 * <script>
 *   const { Composition, Sequence, Rect } = window.KonvaMotion;
 *   const comp = new Composition({ width: 640, height: 360, fps: 30, durationInFrames: 90 });
 *   // ...build comp...
 *   document.querySelector("km-player").composition = comp;
 * </script>
 * ```
 */
import * as KonvaMotion from "@konva-motion/core";
import Konva from "konva";

// Registers <km-player> + every control element as a side effect.
import "./index.js";

declare global {
  interface Window {
    KonvaMotion: typeof KonvaMotion;
    Konva: typeof Konva;
  }
}

const g = globalThis as unknown as Window;
g.KonvaMotion = KonvaMotion;
g.Konva = Konva;

// Re-exported so the IIFE global (`window.KonvaMotionPlayer`) carries the
// player element classes too.
export * from "./index.js";

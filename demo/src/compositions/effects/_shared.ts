/* ============================================================
   Shared scaffolding for the effects gallery — one designed,
   self-contained scene per @smoove/effects filter or shader
   source. Every demo is an 8s loop at 60fps; all motion is a
   pure function of the frame (no wall clock, no Math.random),
   so scrubbing and server renders are identical.
   ============================================================ */
import { Composition } from "@smoove/core";
import Konva from "konva";

export const W = 1280;
export const H = 720;
export const FPS = 60;
export const DURATION = FPS * 8;

/** A fresh, looping 1280×720 Composition — the canvas every demo animates on. */
export function makeComp(id: string): Composition {
  return new Composition({
    id,
    fps: FPS,
    durationInFrames: DURATION,
    width: W,
    height: H,
    loop: true,
  });
}

/** Deterministic 0..1 hash — frame-seeded "randomness" that scrubs correctly. */
export function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** 0..1 phase of the loop, so animations land back where they started. */
export function phase(frame: number): number {
  return (frame % DURATION) / DURATION;
}

/** A transparent canvas with one huge centered glyph — the "logo" the image effects animate. */
export function glyphCanvas(glyph: string, color = "#111111", size = 900): HTMLCanvasElement {
  const canvas = Konva.Util.createCanvasElement();
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(size * 0.78)}px Helvetica, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, size / 2, size / 2 + size * 0.02);
  return canvas;
}

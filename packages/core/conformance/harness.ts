import Konva from "konva";
import {
  Block,
  Composition,
  type ImageLoader,
  type LoadedImage,
  measure,
  Sequence,
} from "../src/index.js";
import { probe as probeAll } from "../src/testing/index.js";
import type { CaseProbe, CaseResult, LayoutCase, Rect } from "./types.js";

const DEFAULT_SIZE: [number, number] = [480, 240];

/** The page behind every case. Distinct from any case colour so probes can tell them apart. */
export const PAGE_BG = "#101820";

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * `build.toString()` keeps the indentation of the source file it came from.
 * Strip the smallest common indent off every line after the first so the
 * report shows the code at column zero.
 */
export function dedent(src: string): string {
  const lines = src.split("\n");
  const rest = lines.slice(1).filter((l) => l.trim().length > 0);
  const indent = rest.reduce((min, l) => Math.min(min, l.length - l.trimStart().length), 80);
  return [lines[0], ...lines.slice(1).map((l) => l.slice(indent))].join("\n").trim();
}

/**
 * A painted canvas standing in for a decoded bitmap — deterministic, no IO.
 * `LoadedImage` is defined by its intrinsic dimensions, which a canvas does not
 * carry, so they are defined onto it here.
 */
export function syntheticImage(width: number, height: number): ImageLoader {
  const canvas = Konva.Util.createCanvasElement();
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = "#4ea1ff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#ff6b4e";
  ctx.fillRect(0, 0, width / 2, height / 2);
  Object.defineProperty(canvas, "naturalWidth", { value: width });
  Object.defineProperty(canvas, "naturalHeight", { value: height });
  return () => Promise.resolve(canvas as unknown as LoadedImage);
}

function makeProbe(comp: Composition, pixels: Uint8ClampedArray, width: number): CaseProbe {
  const find = (selector: string): Konva.Node[] => comp.find(selector);
  const rect = (node: Konva.Node): Rect => {
    const m = measure(node);
    return { x: m.x, y: m.y, width: m.width, height: m.height };
  };
  const at = (x: number, y: number): string => {
    const i = (Math.round(y) * width + Math.round(x)) * 4;
    const a = pixels[i + 3] ?? 0;
    if (a === 0) return "transparent";
    return toHex(pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0);
  };
  return {
    box(selector) {
      const node = find(selector)[0];
      if (!node) throw new Error(`no node matched ${selector}`);
      return rect(node);
    },
    boxes(selector) {
      return find(selector).map(rect);
    },
    node(selector) {
      const node = find(selector)[0];
      if (!node) throw new Error(`no node matched ${selector}`);
      return node;
    },
    at,
    expectColor(x, y, hex, tolerance = 6) {
      const got = at(x, y);
      if (got === "transparent") {
        throw new Error(`pixel (${x},${y}) is transparent, expected ${hex}`);
      }
      const [er, eg, eb] = parseHex(hex);
      const [gr, gg, gb] = parseHex(got);
      const off = Math.max(Math.abs(er - gr), Math.abs(eg - gg), Math.abs(eb - gb));
      if (off > tolerance) {
        throw new Error(`pixel (${x},${y}) is ${got}, expected ${hex} (off by ${off})`);
      }
    },
  };
}

/**
 * Build, drive, assert, and capture one case. Never throws on an assertion
 * failure — failures land in `result.failures` so the report shows every case,
 * including the red ones.
 */
export async function runCase(c: LayoutCase): Promise<CaseResult> {
  const [w, h] = c.size ?? DEFAULT_SIZE;
  const frames = c.frames ?? [1];
  const comp = new Composition({
    id: `conformance-${c.id}`,
    fps: 30,
    durationInFrames: Math.max(...frames) + 1,
    width: w,
    height: h,
  });
  const seq = new Sequence();
  comp.add(seq);
  const root = new Block({ x: 0, y: 0, width: w, height: h, background: PAGE_BG });
  seq.add(root);
  c.build(root, seq);
  await comp.whenReady();

  const failures: string[] = [];
  let png = "";
  let geometry: Record<string, Rect> = {};

  for (const frame of frames) {
    comp.setFrame(frame);
    const canvas = comp.captureCanvas();
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) throw new Error("captureCanvas returned a canvas with no 2d context");
    const pixels = ctx.getImageData(0, 0, w, h).data;
    try {
      c.expect(makeProbe(comp, pixels, w), frame);
    } catch (err) {
      failures.push(`frame ${frame}: ${(err as Error).message}`);
    }
    geometry = {};
    for (const p of probeAll(comp, (n) => Boolean(n.name()))) {
      geometry[p.name] = { x: p.box.x, y: p.box.y, width: p.box.width, height: p.box.height };
    }
    png = (canvas as unknown as { toDataURL(type?: string): string }).toDataURL("image/png");
  }

  return { case: c, png, geometry, source: dedent(c.build.toString()), failures };
}

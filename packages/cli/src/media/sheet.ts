/**
 * `media_sheet`: a contact sheet of raw footage, one tile per time, each
 * stamped with its timecode. Laid out like the studio's composition sheets so
 * an agent reads both the same way.
 */
import { join, relative } from "node:path";
import {
  DEFAULT_TILE_WIDTH,
  MAX_SHEET_FRAMES,
  MIN_SHEET_FRAMES,
  SHEET_COLUMNS,
} from "@smoove/agent";
import type { CanvasRenderingContext2D as SkiaContext } from "skia-canvas";
import type { CommandResult, RunContext } from "../commands.js";
import { done } from "../run.js";
import { MediaError, mediaKey, projectSource, writeAtomic } from "./cache.js";
import { framesAt, keyframeTimes } from "./frames.js";
import { cachedInfo } from "./info.js";
import { clock, loadMedia, runMedia } from "./runtime.js";

const DEFAULT_TILES = 12;
const PAD = 8;

/** The times a sheet shows, before any keyframe snapping. */
export function sheetTimes(
  duration: number,
  opts: { tiles?: number; from?: number; to?: number; at?: number[] },
): number[] {
  const last = Math.max(0, duration - 0.001);
  if (opts.at?.length) {
    return [
      ...new Set(opts.at.map((t) => Math.round(Math.min(Math.max(t, 0), last) * 1000) / 1000)),
    ].sort((a, b) => a - b);
  }
  const tiles = Math.min(MAX_SHEET_FRAMES, Math.max(MIN_SHEET_FRAMES, opts.tiles ?? DEFAULT_TILES));
  const from = Math.max(0, opts.from ?? 0);
  const to = Math.min(duration, opts.to ?? duration);
  const slice = (to - from) / tiles;
  return Array.from(
    { length: tiles },
    (_, i) => Math.round((from + slice * (i + 0.5)) * 1000) / 1000,
  );
}

function fitLabel(g: SkiaContext, text: string, width: number): string {
  let t = text;
  while (t.length > 1 && g.measureText(t).width > width - 4) t = t.slice(0, -1);
  return t;
}

export function runMediaSheet(
  ctx: RunContext,
  input: {
    source: string;
    tiles?: number;
    from?: number;
    to?: number;
    at?: number[];
    width?: number;
    exact?: boolean;
  },
): Promise<CommandResult> {
  return runMedia(ctx, async (root) => {
    const source = projectSource(root, ctx.cwd, input.source, ctx.door);
    const info = await cachedInfo(root, source);
    if (!info.hasVideo)
      throw new MediaError("no-video-track", `${source} has no video track to look at.`);
    if (
      !input.at?.length &&
      Math.max(0, input.from ?? 0) >= Math.min(info.duration, input.to ?? info.duration)
    ) {
      throw new MediaError(
        "bad-request",
        `${source} is ${clock(info.duration, 1)} long, so there's nothing to show from ${clock(input.from ?? 0, 1)}${input.to !== undefined ? ` to ${clock(input.to, 1)}` : ""}.`,
      );
    }
    const wanted = sheetTimes(info.duration, input);
    const times = input.exact ? wanted : await keyframeTimes(root, source, wanted);

    const { skia } = await loadMedia();
    const tileW = Math.max(
      1,
      Math.min(input.width ?? DEFAULT_TILE_WIDTH, info.width ?? DEFAULT_TILE_WIDTH),
    );
    const tileH = Math.max(1, Math.round((tileW * (info.height ?? 1)) / (info.width ?? 1)));
    const labelH = Math.max(18, Math.round(tileW * 0.075));
    const cols = Math.min(SHEET_COLUMNS, times.length);
    const rows = Math.ceil(times.length / cols);
    const sheet = new skia.Canvas(
      cols * tileW + (cols + 1) * PAD,
      rows * (tileH + labelH) + (rows + 1) * PAD,
    );
    const g = sheet.getContext("2d") as SkiaContext;
    g.fillStyle = "#16161a";
    g.fillRect(0, 0, sheet.width, sheet.height);
    g.font = `${Math.round(labelH * 0.62)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    g.textBaseline = "middle";

    const tile = new skia.Canvas(tileW, tileH);
    const tg = tile.getContext("2d");
    const shown: number[] = [];
    let i = 0;
    for await (const frame of framesAt(root, source, times, tileW)) {
      const x = PAD + (i % cols) * (tileW + PAD);
      const y = PAD + Math.floor(i / cols) * (tileH + labelH + PAD);
      const data = new skia.ImageData(frame.rgba, frame.width, frame.height);
      tg.reset();
      tg.putImageData(data, 0, 0);
      g.drawImage(tile, x, y);
      const time = frame.at;
      g.fillStyle = "#e8e8ec";
      g.fillText(fitLabel(g, clock(time, 1), tileW), x + 2, y + tileH + labelH / 2);
      shown.push(time);
      i++;
    }

    const name = `${shown[0] ?? 0}-${shown[shown.length - 1] ?? 0}-${shown.length}-${tileW}${input.exact ? "-exact" : ""}.png`;
    const abs = join(mediaKey(root, source).dir, "sheets", name);
    writeAtomic(abs, await sheet.toBuffer("png"));
    const image = relative(root, abs);
    return {
      ...done({ image, tiles: shown, tileWidth: tileW }, [
        image,
        `${shown.length} tiles of ${source} at ${shown.map((t) => clock(t, 1)).join(", ")}${input.exact ? "" : ", each at the keyframe at or before the time asked for"}.`,
      ]),
      images: [{ path: abs, inline: true }],
    };
  });
}

// Self-contained end-to-end example for @konva-motion/renderer.
//
// Run from the package dir:  pnpm --filter @konva-motion/renderer example
// (or:  npx tsx examples/render-demo.ts)
//
// It synthesizes its own assets (a PNG via skia + a sine tone via ffmpeg), builds
// a Composition with shapes + an Image + an Audio node, then exercises
// renderComposition (-> mp4), renderStill (-> png) and renderFrames (count).

import "@konva-motion/renderer/register";

import { spawnSync } from "node:child_process";
import { mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Audio, Composition, Image, Sequence, interpolate } from "@konva-motion/core";
import {
  probeComposition,
  renderComposition,
  renderFrames,
  renderStill,
  resolveFfmpegPath,
} from "@konva-motion/renderer";
import Konva from "konva";
import { Canvas } from "skia-canvas";

const FPS = 30;
const TOTAL = 60; // 2s
const WIDTH = 640;
const HEIGHT = 360;

const dir = mkdtempSync(join(tmpdir(), "km-renderer-demo-"));

// ---- asset 1: a PNG drawn with skia ----
const imgPath = join(dir, "card.png");
{
  const c = new Canvas(400, 240);
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 400, 240);
  g.addColorStop(0, "#4ea1ff");
  g.addColorStop(1, "#b14eff");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 400, 240);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 40px sans-serif";
  ctx.fillText("konva-motion", 30, 130);
  writeFileSync(imgPath, c.toBufferSync("png"));
}

// ---- asset 2: a 2s sine tone via ffmpeg ----
const audioPath = join(dir, "tone.wav");
{
  const r = spawnSync(resolveFfmpegPath(), [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=2",
    "-ar",
    "44100",
    audioPath,
  ]);
  if (r.status !== 0) throw new Error(`tone generation failed: ${r.stderr}`);
}

function buildComp(): Composition {
  const comp = new Composition({
    id: "renderer-demo",
    fps: FPS,
    durationInFrames: TOTAL,
    width: WIDTH,
    height: HEIGHT,
    mode: "rendering",
  });

  // Background + an animated shape.
  const main = new Sequence({ from: 0, durationInFrames: TOTAL });
  main.add(new Konva.Rect({ x: 0, y: 0, width: WIDTH, height: HEIGHT, fill: "#0d1117" }));
  const dot = new Konva.Circle({ x: 80, y: HEIGHT - 60, radius: 36, fill: "#3fb950" });
  main.add(dot);
  main.register((f) => {
    dot.x(interpolate(f, [0, TOTAL - 1], [80, WIDTH - 80]));
  });

  // An Image node (exercises the SSR-gated loader + delayRender).
  const img = new Image({ src: imgPath, x: 120, y: 60, width: 400, height: 240 });
  main.add(img);
  main.register((f) => {
    img.opacity(interpolate(f, [0, 15], [0, 1], { extrapolateRight: "clamp" }));
  });
  comp.add(main);

  // An Audio node in its own sequence (exercises audio asset collection + mux).
  const audioSeq = new Sequence({ from: 0, durationInFrames: TOTAL });
  audioSeq.add(new Audio({ id: "tone", src: audioPath, volume: 0.6 }));
  comp.add(audioSeq);

  return comp;
}

async function main(): Promise<void> {
  console.log("probe:", probeComposition(buildComp()));

  // 1) full render -> mp4
  const mp4 = join(dir, "out.mp4");
  const result = await renderComposition(buildComp(), {
    output: mp4,
    quality: "medium",
    onProgress: (p) => {
      if (p.frame % 15 === 0 || p.frame === p.total) {
        process.stdout.write(`  frames ${p.frame}/${p.total} @ ${p.fps.toFixed(1)} fps\r`);
      }
    },
  });
  console.log("\nrenderComposition:", result, `(${statSync(mp4).size} bytes)`);
  if (!result.hasAudio) throw new Error("expected audio track");

  // 2) single still -> png
  const stillPath = join(dir, "still.png");
  const buf = await renderStill(buildComp(), { frame: 30, output: stillPath, type: "png" });
  console.log("renderStill:", stillPath, `(${buf.length} bytes)`);

  // 3) frame primitive -> count
  let count = 0;
  for await (const _frame of renderFrames(buildComp(), { range: { from: 0, to: 9 } })) count++;
  console.log("renderFrames yielded:", count, "frames (expected 10)");
  if (count !== 10) throw new Error(`renderFrames count mismatch: ${count}`);

  console.log("\nartifacts in:", dir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Per-frame render profiler. Answers one question: does per-frame cost GROW
 * over a render, and if so, what grows with it (RSS, GL objects)?
 *
 * Usage: node packages/kitchen-sink/scripts/profile-render.mjs <compId> [frames]
 */
import { smoove } from "@smoove/vite";
import { createServer } from "vite";

const id = process.argv[2] ?? "flame-wrap";
const wanted = Number(process.argv[3] ?? 180);

const server = await createServer({
  configFile: false,
  root: new URL("..", import.meta.url).pathname,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  plugins: [smoove()],
  ssr: { external: ["skia-canvas", "gl", "mediabunny", "@mediabunny/server"] },
  logLevel: "warn",
});

const boot = await server.ssrLoadModule("./scripts/profile-bootstrap.ts");
console.log(`[profile] headless-gl instrumented: ${boot.glPatched}`);

const comp = await boot.load(id);
const total = comp.durationInFrames.get();
// Loop past the end when asked for more frames than the comp has, so we can see
// long-render behaviour on a short comp.
const frames = wanted;
console.log(`[profile] ${id}: ${comp.width()}x${comp.height()} @${comp.fps}, ${total} frames`);

const times = [];
const BUCKET = 20;
let bucketStart = process.hrtime.bigint();
let prevGl = { ...boot.glStats };

// Warm-up frame excluded from the stats (first-frame caching, shader compile).
await comp.renderFrame(0);
comp.captureCanvas();

for (let f = 0; f < frames; f++) {
  const t0 = process.hrtime.bigint();
  await comp.renderFrame(f % total);
  const c = comp.captureCanvas();
  // Force the pixels to actually materialize (this is what replays a skia
  // display list, so it must be inside the timing window).
  c.toBufferSync("raw", { colorType: "rgba" });
  const t1 = process.hrtime.bigint();
  times.push(Number(t1 - t0) / 1e6);

  if ((f + 1) % BUCKET === 0) {
    const slice = times.slice(f + 1 - BUCKET, f + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    const wall = Number(process.hrtime.bigint() - bucketStart) / 1e6;
    bucketStart = process.hrtime.bigint();
    // Force a full GC (node --expose-gc) so RSS reflects retained memory, not
    // garbage V8 simply hasn't collected yet.
    global.gc?.();
    const mem = process.memoryUsage();
    const gl = boot.glStats;
    const dGl = Object.keys(prevGl)
      .filter((k) => gl[k] - (prevGl[k] ?? 0) > 0)
      .map((k) => `${k}+${gl[k] - (prevGl[k] ?? 0)}`)
      .join(" ");
    prevGl = { ...gl };
    const pools = globalThis.__smoovePools?.();
    console.log(
      `f${String(f + 1).padStart(4)}  avg ${avg.toFixed(1).padStart(7)} ms   wall ${(wall / 1000).toFixed(1)}s   rss ${(mem.rss / 1e6).toFixed(0)}MB  pools ${JSON.stringify(pools)}  ${dGl}`,
    );
  }
}

const n = Math.min(BUCKET, times.length);
const avgOf = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const first = avgOf(times.slice(0, n));
const last = avgOf(times.slice(-n));
console.log(
  `\n[profile] ${id}: first ${n} = ${first.toFixed(1)}ms/frame, last ${n} = ${last.toFixed(1)}ms/frame  (growth ${(last / first).toFixed(2)}x)`,
);
console.log(
  `[profile] total ${(times.reduce((a, b) => a + b, 0) / 1000).toFixed(1)}s for ${frames} frames`,
);

await server.close();
process.exit(0);

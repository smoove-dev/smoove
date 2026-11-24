#!/usr/bin/env node
// Check that @smoove/core bundles for the browser in an app with no smoove
// setup: pack it, install the tarball in an empty Vite app (no config, no
// lockfile, so dependency ranges resolve the way they do for a user), build,
// and run the result in headless Chrome.
//
// Running it matters as much as building it. When a dependency imports a Node
// module, Vite 6 and 7 fail the build, but Vite 8 stubs the import, builds, and
// the page throws on load.
//
// Needs built packages (`pnpm build`) and Chrome (SMOOVE_BROWSER to name one).
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VITE_MAJORS = [6, 7, 8];
const TIMEOUT_MS = 30_000;
const EXPECTED = "ok: flex-end at 270";

const core = fileURLToPath(new URL("../packages/core", import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), "smoove-browser-"));

const MAIN = `
import { Composition, Flex, Rect, Sequence } from "@smoove/core";
const comp = new Composition({
  id: "smoke", container: "stage", width: 320, height: 180, fps: 30, durationInFrames: 30,
});
const seq = new Sequence({ from: 0, durationInFrames: 30 });
comp.add(seq);
const row = new Flex({ width: 320, height: 180, justifyContent: "flex-end" });
const box = new Rect({ width: 50, height: 40, fill: "red" });
row.add(box);
seq.add(row);
comp.setFrame(0);
document.getElementById("result").textContent = "ok: flex-end at " + box.x();
`;

const HTML = `<!doctype html>
<div id="stage"></div>
<div id="result">the app did not run</div>
<script>
addEventListener("error", (e) => { document.getElementById("result").textContent = e.message; });
</script>
<script type="module" src="/main.js"></script>
`;

function findChrome() {
  const candidates = [
    process.env.SMOOVE_BROWSER,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
  ];
  for (const bin of candidates) {
    if (bin && spawnSync(bin, ["--version"], { stdio: "ignore" }).status === 0) return bin;
  }
  throw new Error("No Chrome found. Install it, or set SMOOVE_BROWSER.");
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

function serve(dir) {
  const server = createServer((req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;
    const file = join(dir, path === "/" ? "index.html" : path);
    if (!existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

/** Load the built app and return what it wrote to `#result`. */
async function runInChrome(chrome, dist, profile) {
  const { server, port } = await serve(dist);
  try {
    const html = await new Promise((resolve, reject) => {
      const child = spawn(
        chrome,
        [
          "--headless",
          "--no-sandbox",
          "--disable-gpu",
          `--user-data-dir=${profile}`,
          "--virtual-time-budget=5000",
          "--dump-dom",
          `http://127.0.0.1:${port}/`,
        ],
        { stdio: ["ignore", "pipe", "ignore"], timeout: TIMEOUT_MS },
      );
      let out = "";
      child.stdout.on("data", (chunk) => {
        out += chunk;
      });
      child.on("error", reject);
      child.on("close", () => resolve(out));
    });
    return /<div id="result">([^<]*)<\/div>/.exec(html)?.[1] ?? "Chrome returned no page";
  } finally {
    server.close();
  }
}

async function smoke(major, tarball, chrome) {
  const app = join(tmp, `vite-${major}`);
  mkdirSync(app);
  writeFileSync(join(app, "package.json"), '{ "private": true, "type": "module" }\n');
  writeFileSync(join(app, "index.html"), HTML);
  writeFileSync(join(app, "main.js"), MAIN);
  const opts = { cwd: app, encoding: "utf8" };
  execFileSync(
    "npm",
    ["install", "--no-audit", "--no-fund", "--silent", tarball, "konva@10", `vite@${major}`],
    opts,
  );
  const build = spawnSync("npx", ["--no-install", "vite", "build"], opts);
  const log = `${build.stdout}${build.stderr}`;
  if (build.status !== 0) throw new Error(`the build failed:\n${log}`);
  if (log.includes("externalized for browser")) {
    throw new Error(`the bundle reaches for a Node module:\n${log}`);
  }
  const result = await runInChrome(chrome, join(app, "dist"), join(app, "chrome"));
  if (result !== EXPECTED) throw new Error(`in Chrome, expected "${EXPECTED}", got "${result}"`);
}

let failed = false;
try {
  const chrome = findChrome();
  const packed = execFileSync("npm", ["pack", "--silent", "--pack-destination", tmp], {
    cwd: core,
    encoding: "utf8",
  });
  const tarball = join(tmp, packed.trim().split("\n").at(-1));
  for (const major of VITE_MAJORS) {
    try {
      await smoke(major, tarball, chrome);
      console.log(`✔ vite ${major}: builds and runs`);
    } catch (error) {
      failed = true;
      console.error(`✘ vite ${major}: ${error.message}`);
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
if (failed) process.exit(1);

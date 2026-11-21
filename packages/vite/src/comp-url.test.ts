import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import { smoove } from "./index.js";

let project = "";

afterEach(() => {
  if (project) rmSync(project, { recursive: true, force: true });
});

/** A one-page app whose entry imports a composition that imports a video. */
function makeProject(): string {
  // realpath: macOS tmp is a symlink, which Vite's HTML step rejects.
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "smoove-comp-url-")));
  writeFileSync(join(dir, "clip.mp4"), Buffer.alloc(64 * 1024, 7));
  writeFileSync(join(dir, "demo.ts"), `import clip from "./clip.mp4";\nexport default { clip };\n`);
  writeFileSync(join(dir, "main.ts"), `import url from "./demo.ts?comp-url";\nconsole.log(url);\n`);
  writeFileSync(join(dir, "index.html"), `<script type="module" src="./main.ts"></script>`);
  return dir;
}

async function buildProject(compAssetBase?: string) {
  project = makeProject();
  await build({
    root: project,
    configFile: false,
    logLevel: "silent",
    plugins: [smoove({ agent: false, compAssetBase })],
  });
  const assets = join(project, "dist/assets");
  const files = readdirSync(assets);
  const demo = files.find((f) => /^demo-[0-9a-f]{8}\.js$/.test(f));
  const video = files.find((f) => /^clip-.+\.mp4$/.test(f));
  return {
    demo: demo ? readFileSync(join(assets, demo), "utf8") : "",
    video,
    videoBytes: video ? readFileSync(join(assets, video)).length : 0,
  };
}

describe("?comp-url media", () => {
  it("emits imported media as files instead of inlining them", async () => {
    const { demo, video, videoBytes } = await buildProject();
    expect(video).toBeDefined();
    expect(videoBytes).toBe(64 * 1024);
    expect(demo).not.toContain("data:video");
    expect(demo).toContain(`"/assets/${video}"`);
  });

  it("points media at compAssetBase when it is set", async () => {
    const { demo, video } = await buildProject("https://media.example.com/");
    expect(video).toBeDefined();
    expect(demo).toContain(`"https://media.example.com/assets/${video}"`);
  });
});

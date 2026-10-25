import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BROWSER_ENV, captureScreenshot, NoBrowserError } from "./headless.js";

let dir: string;
let saved: string | undefined;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "smoove-shot-"));
  saved = process.env[BROWSER_ENV];
});

afterEach(() => {
  if (saved === undefined) delete process.env[BROWSER_ENV];
  else process.env[BROWSER_ENV] = saved;
  rmSync(dir, { recursive: true, force: true });
});

/** A stand-in browser: records its arguments and writes a file at --screenshot. */
function fakeBrowser(opts: { sleep?: boolean } = {}): string {
  const file = join(dir, "browser.mjs");
  writeFileSync(
    file,
    `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(join(dir, "args.json"))}, JSON.stringify(process.argv.slice(2)));
${opts.sleep ? "setTimeout(() => {}, 60000);" : ""}
const out = process.argv.find((a) => a.startsWith("--screenshot="));
${opts.sleep ? "" : 'if (out) writeFileSync(out.slice("--screenshot=".length), "PNG");'}
`,
  );
  chmodSync(file, 0o755);
  return file;
}

describe("captureScreenshot", () => {
  it("passes the window size and writes the screenshot", async () => {
    process.env[BROWSER_ENV] = fakeBrowser();
    const out = join(dir, "shot.png");
    const profileDir = join(dir, "profile");
    await captureScreenshot("https://example.com", { out, width: 1280, height: 800, profileDir });
    expect(readFileSync(out, "utf8")).toBe("PNG");
    const args = JSON.parse(readFileSync(join(dir, "args.json"), "utf8")) as string[];
    expect(args).toContain("--window-size=1280,800");
    expect(args).toContain("--headless=new");
    expect(args).toContain(`--screenshot=${out}`);
    expect(args.at(-1)).toBe("https://example.com");
    expect(existsSync(profileDir)).toBe(false);
  });

  it("times out and cleans up", async () => {
    process.env[BROWSER_ENV] = fakeBrowser({ sleep: true });
    const profileDir = join(dir, "profile");
    await expect(
      captureScreenshot("https://example.com", {
        out: join(dir, "shot.png"),
        width: 800,
        height: 600,
        profileDir,
        timeoutMs: 300,
      }),
    ).rejects.toThrow(/didn't finish/);
    expect(existsSync(profileDir)).toBe(false);
  });

  it("says when no browser is installed", async () => {
    process.env[BROWSER_ENV] = join(dir, "missing-browser");
    await expect(
      captureScreenshot("https://example.com", {
        out: join(dir, "shot.png"),
        width: 800,
        height: 600,
        profileDir: join(dir, "profile"),
      }),
    ).rejects.toBeInstanceOf(NoBrowserError);
  });
});

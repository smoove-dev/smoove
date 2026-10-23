import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AssetRecord } from "@smoove/agent";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RunContext } from "../commands.js";
import { PNG, tempProject } from "../test/fake-bridge.js";
import { pageName, runPageShot } from "./page-shot.js";

let project: ReturnType<typeof tempProject>;
let bin: string;
let saved: string | undefined;

beforeEach(() => {
  project = tempProject();
  bin = mkdtempSync(join(tmpdir(), "smoove-browser-"));
  saved = process.env.SMOOVE_BROWSER;
  const script = join(bin, "browser.mjs");
  writeFileSync(
    script,
    `#!/usr/bin/env node
import { appendFileSync, writeFileSync } from "node:fs";
const profile = process.argv.find((a) => a.startsWith("--user-data-dir="));
appendFileSync(${JSON.stringify(join(bin, "profiles.log"))}, \`\${profile}\\n\`);
const out = process.argv.find((a) => a.startsWith("--screenshot="));
writeFileSync(out.slice("--screenshot=".length), Buffer.from(${JSON.stringify(Buffer.from(PNG).toString("base64"))}, "base64"));
`,
  );
  chmodSync(script, 0o755);
  process.env.SMOOVE_BROWSER = script;
});

afterEach(() => {
  if (saved === undefined) delete process.env.SMOOVE_BROWSER;
  else process.env.SMOOVE_BROWSER = saved;
  project.remove();
  rmSync(bin, { recursive: true, force: true });
});

const ctx = (): RunContext => ({
  cwd: project.root,
  env: process.env,
  sleep: async () => {},
  door: "mcp",
});

describe("page_shot", () => {
  it("names a shot after the page", () => {
    expect(pageName("https://example.com/docs")).toBe("example-com-docs");
    expect(pageName("https://www.example.com/")).toBe("example-com");
  });

  it("saves a page shot as a credited asset", async () => {
    const result = await runPageShot(ctx(), { url: "https://example.com/docs" });
    expect(result.code).toBe(0);
    expect(existsSync(join(project.root, "assets/example-com-docs.png"))).toBe(true);
    const credits = JSON.parse(
      readFileSync(join(project.root, "assets/credits.json"), "utf8"),
    ) as AssetRecord[];
    expect(credits[0]).toMatchObject({
      file: "assets/example-com-docs.png",
      kind: "screenshot",
      source: "https://example.com/docs",
      page: "https://example.com/docs",
      license: "screenshot",
    });
    expect(result.images[0]?.inline).toBe(true);
  });

  it("gives parallel shots their own browser profiles", async () => {
    const results = await Promise.all([
      runPageShot(ctx(), { url: "https://example.com/a" }),
      runPageShot(ctx(), { url: "https://example.com/b" }),
    ]);
    expect(results.map((r) => r.code)).toEqual([0, 0]);
    const profiles = readFileSync(join(bin, "profiles.log"), "utf8").trim().split("\n");
    expect(new Set(profiles).size).toBe(2);
  });

  it("refuses an address that isn't a web page", async () => {
    const result = await runPageShot(ctx(), { url: "file:///etc/passwd" });
    expect(result.code).toBe(1);
    expect(result.errors).toContain("http");
  });
});

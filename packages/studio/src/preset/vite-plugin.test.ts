import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type InlineConfig, searchForWorkspaceRoot, type ViteDevServer } from "vite";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Registry } from "../types.js";
import { loadStudioConfig } from "./load-config.js";
import { smooveStudio } from "./vite-plugin.js";

const fixture = fileURLToPath(new URL("../../test-fixtures/preset-project", import.meta.url));
const defineRegistryFile = fileURLToPath(
  new URL("../registry/define-registry.ts", import.meta.url),
);

let server: ViteDevServer | null = null;
let temp = "";
afterEach(async () => {
  await server?.close();
  server = null;
  if (temp) rmSync(temp, { recursive: true, force: true });
  temp = "";
  vi.restoreAllMocks();
});

function config(root: string): InlineConfig {
  return {
    root,
    configFile: false,
    logLevel: "silent",
    server: { middlewareMode: true, ws: false },
    plugins: smooveStudio({ root, agent: false }),
    // A package can't import itself by name here; the registry module only needs defineRegistry.
    resolve: { alias: [{ find: "@smoove/studio", replacement: defineRegistryFile }] },
  };
}

describe("smooveStudio", () => {
  it("builds the registry from the compositions folder", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    server = await createServer(config(fixture));
    const mod = await server.ssrLoadModule("virtual:smoove/registry.ts");
    const registry = mod.default as Registry;
    expect(registry.entries().map((e) => e.id)).toEqual(["one", "two"]);
    const problems = registry.problems();
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain("compositions/empty");
  });

  it("serves the resolved smoove.config.ts", async () => {
    server = await createServer(config(fixture));
    const mod = await server.ssrLoadModule("virtual:smoove/config");
    expect(mod.default).toEqual({
      name: "Fixture",
      logoUrl: null,
      primaryColor: null,
      render: true,
    });
  });

  it("applies the optimizer and file-access settings", async () => {
    server = await createServer(config(fixture));
    expect(server.config.optimizeDeps.include).toEqual(
      expect.arrayContaining(["@smoove/core", "konva", "react", "react-dom"]),
    );
    // Base UI is reached through the studio, so a strict pnpm install resolves it.
    expect(server.config.optimizeDeps.include).toContain("@smoove/studio > @base-ui/react/dialog");
    expect(server.config.server.fs.allow).toEqual(expect.arrayContaining([fixture]));
    // Setting fs.allow turns off Vite's own workspace-root allowance, so the
    // plugin keeps it: packages hoisted above the project must stay readable.
    expect(server.config.server.fs.allow).toEqual(
      expect.arrayContaining([searchForWorkspaceRoot(fixture)]),
    );
    expect(server.config.resolve.dedupe).toEqual(expect.arrayContaining(["react", "react-dom"]));
  });
});

describe("loadStudioConfig", () => {
  it("names the file and the key of a bad config", async () => {
    temp = mkdtempSync(join(tmpdir(), "smoove-load-config-"));
    cpSync(fixture, temp, { recursive: true });
    writeFileSync(join(temp, "smoove.config.ts"), 'export default { colour: "red" };\n');
    await expect(loadStudioConfig(temp)).rejects.toThrow(/smoove\.config\.ts.*colour/s);
  });

  it("uses the defaults when there's no config file", async () => {
    temp = mkdtempSync(join(tmpdir(), "smoove-load-config-"));
    await expect(loadStudioConfig(temp)).resolves.toEqual({
      name: null,
      logo: null,
      primaryColor: null,
      render: true,
    });
  });
});

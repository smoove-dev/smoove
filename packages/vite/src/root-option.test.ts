import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import { smoove } from "./index.js";

let server: ViteDevServer | null = null;
let project = "";

afterEach(async () => {
  await server?.close();
  server = null;
  if (project) rmSync(project, { recursive: true, force: true });
});

async function waitFor(file: string, ms = 2000): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (existsSync(file)) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return existsSync(file);
}

describe("smoove root option", () => {
  it("writes the discovery file into the given root", async () => {
    project = mkdtempSync(join(tmpdir(), "smoove-root-"));
    const app = join(project, "app");
    mkdirSync(app);
    server = await createServer({
      root: app,
      configFile: false,
      logLevel: "silent",
      plugins: [smoove({ root: project })],
      server: { port: 0 },
    });
    await server.listen();
    expect(await waitFor(join(project, ".smoove/agent.json"))).toBe(true);
    expect(existsSync(join(app, ".smoove/agent.json"))).toBe(false);
  });
});

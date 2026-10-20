import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunContext } from "../commands.js";
import { type FakeBridge, json, startBridge, tempProject } from "../test/fake-bridge.js";
import { createMcpServer } from "./server.js";

let project: ReturnType<typeof tempProject>;
let fake: FakeBridge | null = null;
let client: Client | null = null;

beforeEach(() => {
  project = tempProject();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await client?.close();
  client = null;
  await fake?.close();
  fake = null;
  project.remove();
});

function base(
  sleep: RunContext["sleep"] = (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 5))),
) {
  return { cwd: project.root, env: { ...process.env }, sleep };
}

async function connect(b = base()): Promise<Client> {
  const server = createMcpServer(b, "0.0.0-test");
  const [clientEnd, serverEnd] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "smoove-test", version: "1.0.0" });
  await server.connect(serverEnd);
  await client.connect(clientEnd);
  return client;
}

describe("standard output belongs to the protocol", () => {
  it("writes nothing to standard output while every tool runs, start and stop included", async () => {
    // A dev script that announces itself the way the bridge does, then waits.
    writeFileSync(
      join(project.root, "fake-dev.mjs"),
      `import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync(".smoove", { recursive: true });
writeFileSync(".smoove/agent.json", JSON.stringify({ url: "http://127.0.0.1:9/", token: "t", pid: process.pid, startedAt: new Date().toISOString() }));
console.log("dev server output that must not reach the protocol");
setInterval(() => {}, 1000);
`,
    );
    writeFileSync(
      join(project.root, "package.json"),
      JSON.stringify({ scripts: { dev: "node fake-dev.mjs" } }),
    );
    const c = await connect();
    const write = vi.spyOn(process.stdout, "write");
    const log = vi.spyOn(console, "log");
    for (const [name, args] of [
      ["status", {}],
      ["start", {}],
      ["snap", {}],
      ["sheet", {}],
      ["timeline", {}],
      ["context", {}],
      ["check", { groups: ["layout"] }],
      ["seek", { frame: 0 }],
      ["render", { wait: false }],
      ["stop", {}],
    ] as const) {
      const r = (await c.callTool({ name, arguments: args })) as {
        content: Array<{ text?: string }>;
      };
      if (name === "start") expect(r.content[0]?.text).toContain("The studio is running");
    }
    expect(write).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  }, 30_000);

  it("speaks only protocol messages over a real stdio transport", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const server = createMcpServer(base(), "0.0.0-test");
    await server.connect(new StdioServerTransport(input, output));
    let raw = "";
    output.on("data", (d: Buffer) => {
      raw += d.toString("utf8");
    });
    const send = (m: unknown) => input.write(`${JSON.stringify(m)}\n`);
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "t", version: "1" },
      },
    });
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "status", arguments: {} },
    });
    for (let i = 0; i < 200 && !raw.includes('"id":2'); i++)
      await new Promise((r) => setTimeout(r, 10));
    const lines = raw.split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    for (const line of lines) expect(JSON.parse(line).jsonrpc).toBe("2.0");
    await server.close();
  });

  it("stops waiting for a render when the client cancels", async () => {
    fake = await startBridge(project.root, (req) =>
      json(req.type === "render" ? { jobId: "j1", composition: "promo", format: "mp4" } : {}),
    );
    let sleeps = 0;
    const c = await connect(
      base((ms) => {
        sleeps += 1;
        return new Promise((r) => setTimeout(r, Math.min(ms, 5)));
      }),
    );
    const abort = new AbortController();
    const pending = c
      .callTool({ name: "render", arguments: { composition: "promo" } }, { signal: abort.signal })
      .catch(() => null);
    for (let i = 0; i < 200 && sleeps < 3; i++) await new Promise((r) => setTimeout(r, 5));
    abort.abort();
    await pending;
    await new Promise((r) => setTimeout(r, 50));
    const after = sleeps;
    await new Promise((r) => setTimeout(r, 100));
    expect(sleeps).toBe(after);
  });
});

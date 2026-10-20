import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TabRequest } from "../index.js";
import { type AgentBridge, createAgentBridge } from "../server/bridge.js";
import { formatTimeline, type Io, main } from "./main.js";

let root: string;
let bridge: AgentBridge | null = null;
let server: Server | null = null;
let origin = "";

function io(cwd = root) {
  const out: string[] = [];
  const err: string[] = [];
  const value: Io = {
    cwd,
    out: (t) => out.push(t),
    err: (t) => err.push(t),
    sleep: () => Promise.resolve(),
    env: {},
  };
  return { io: value, out, err };
}

async function startServer() {
  bridge = createAgentBridge({ root, settleMs: 0, launchBrowser: false });
  const b = bridge;
  server = createServer((req, res) => b.handle(req, res, () => res.end()));
  await new Promise<void>((r) => server?.listen(0, "127.0.0.1", () => r()));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  bridge.listening(origin);
}

/** A studio tab that answers the first request with `answer`. */
async function tabAnswering(
  answer: (req: TabRequest) => { body: BodyInit; type: string; query?: Record<string, string> },
) {
  const abort = new AbortController();
  const res = await fetch(`${origin}/__smoove/agent/tab/connect?path=/c/promo&composition=promo`, {
    signal: abort.signal,
  });
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  void (async () => {
    try {
      for (;;) {
        const chunk = await reader?.read();
        if (!chunk || chunk.done) return;
        buf += decoder.decode(chunk.value, { stream: true });
        for (let i = buf.indexOf("\n\n"); i >= 0; i = buf.indexOf("\n\n")) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          if (!block.startsWith("event: request")) continue;
          const req = JSON.parse(block.split("data: ")[1] ?? "{}") as TabRequest;
          const a = answer(req);
          const qs = new URLSearchParams({ req: req.id, ...a.query });
          await fetch(`${origin}/__smoove/agent/tab/reply?${qs}`, {
            method: "POST",
            headers: { "Content-Type": a.type },
            body: a.body,
          });
        }
      }
    } catch {
      // aborted
    }
  })();
  return () => abort.abort();
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "smoove-cli-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { dev: "vite" } }));
});

afterEach(async () => {
  bridge?.close();
  bridge = null;
  server?.closeAllConnections();
  await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
  server = null;
  rmSync(root, { recursive: true, force: true });
});

describe("smoove", () => {
  it("prints usage and exits 2 on a bad command or option", async () => {
    const a = io();
    expect(await main(["dance"], a.io)).toBe(2);
    expect(a.err.join("\n")).toContain('Unknown command "dance"');
    const b = io();
    expect(await main(["snap", "--frame", "x"], b.io)).toBe(2);
    const c = io();
    expect(await main(["--help"], c.io)).toBe(0);
    expect(c.out[0]).toContain("smoove start");
  });

  it("says to run smoove start when no server is running", async () => {
    const a = io();
    expect(await main(["status"], a.io)).toBe(1);
    expect(a.err[0]).toContain("smoove start");
    const b = io();
    expect(await main(["snap", "--json"], b.io)).toBe(1);
    expect(JSON.parse(b.out[0] ?? "{}").error.code).toBe("no-server");
  });

  it("reports status with no tab, from a subfolder of the project", async () => {
    await startServer();
    mkdirSync(join(root, "src"));
    const a = io(join(root, "src"));
    expect(await main(["status"], a.io)).toBe(0);
    expect(a.out[0]).toContain(`Give the user this URL: ${origin}/`);
  });

  it("takes a snapshot through a tab and prints the path", async () => {
    await startServer();
    const close = await tabAnswering(() => ({
      body: new Uint8Array([1, 2, 3]),
      type: "image/png",
      query: { composition: "promo", frame: "12", width: "640", height: "360" },
    }));
    const a = io();
    expect(await main(["snap", "--frame", "12"], a.io)).toBe(0);
    expect(a.out[0]).toContain(join(root, ".smoove", "snaps", "promo-f12-w640.png"));
    expect(a.out[0]).toContain("drawn by the user's tab at /c/promo");

    const b = io();
    expect(await main(["snap", "--frame", "12", "--json"], b.io)).toBe(0);
    expect(JSON.parse(b.out[0] ?? "{}").ok).toBe(true);
    close();
  });

  it("exits 1 and prints the bridge's error", async () => {
    await startServer();
    const a = io();
    expect(await main(["seek", "5"], a.io)).toBe(1);
    expect(a.err[0]).toMatch(/^Error \(no-tab\)/);
  });

  it("refuses to stop a server smoove start didn't start", async () => {
    await startServer();
    const a = io();
    expect(await main(["stop"], a.io)).toBe(1);
    expect(a.err[0]).toContain("wasn't started by smoove start");
  });

  it("formats the timeline as beats and an indented tree", () => {
    const text = formatTimeline({
      composition: "promo",
      width: 1080,
      height: 1920,
      fps: 30,
      durationInFrames: 150,
      beatsFrom: "plan",
      beats: [
        { name: "hook", start: 0, settled: 0, end: 75, sheet: 74 },
        { name: "land", start: 65, settled: 75, end: 150, sheet: 149 },
      ],
      sequences: [
        {
          name: "hook",
          kind: "sequence",
          start: 0,
          end: 75,
          children: [{ name: "logo", kind: "clip", start: 10, end: 40, children: [] }],
        },
      ],
    });
    expect(text).toBe(
      [
        "promo: 1080 by 1920, 30 fps, 150 frames (frames 0 to 149)",
        "Beats, from the plan:",
        "  hook: frames 0 to 74, sheet frame 74",
        "  land: frames 65 to 149, settled at 75, sheet frame 149",
        "Sequences:",
        "  hook (sequence): frames 0 to 74",
        "    logo (clip): frames 10 to 39",
      ].join("\n"),
    );
  });
});

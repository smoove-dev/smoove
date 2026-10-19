import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Mark, MarkInput, StatusData, TabRequest } from "../index.js";
import { type AgentBridge, createAgentBridge } from "../server/bridge.js";
import { formatContext, formatStatus, formatTimeline, type Io, main } from "./main.js";

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

function walkthroughMark(): Mark {
  return {
    id: "m1",
    composition: "promo",
    frame: 120,
    beat: "land",
    rect: { x: 312, y: 180, width: 640, height: 160 },
    nodes: [
      {
        name: "title",
        id: null,
        type: "Text",
        box: { x: 330, y: 196, width: 600, height: 120 },
        cover: 0.98,
        text: "Launch day",
        ancestors: ["hero", "card"],
        source: { file: "src/compositions/promo.ts", line: 42, column: 17, inherited: false },
      },
      {
        name: "card",
        id: null,
        type: "Flex",
        box: { x: 300, y: 170, width: 680, height: 220 },
        cover: 0.71,
        ancestors: ["hero"],
        source: { file: "src/compositions/promo.ts", line: 35, column: 16, inherited: false },
      },
    ],
    drawnAt: "2026-10-19T20:00:00.000Z",
    drawnBy: { tabId: "t1", path: "/c/promo", visible: true, headless: false },
    image: "/path/to/project/.smoove/marks/promo-f120.png",
  };
}

/** Connect a tab, read its id from the hello event, and post `mark` from it. */
async function postMarkFromTab(mark: MarkInput): Promise<() => void> {
  const abort = new AbortController();
  const res = await fetch(`${origin}/__smoove/agent/tab/connect?path=/c/promo`, {
    signal: abort.signal,
  });
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let tabId = "";
  while (!tabId) {
    const chunk = await reader?.read();
    if (!chunk || chunk.done) throw new Error("stream closed");
    buf += decoder.decode(chunk.value, { stream: true });
    const m = /event: hello\ndata: (.*)\n/.exec(buf);
    if (m?.[1]) tabId = (JSON.parse(m[1]) as { tabId: string }).tabId;
  }
  await fetch(`${origin}/__smoove/agent/tab/mark`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tabId, mark }),
  });
  return () => abort.abort();
}

describe("smoove context", () => {
  it("formats a mark as the spec's sample", () => {
    expect(formatContext({ mark: walkthroughMark() })).toBe(
      [
        "Mark on promo, frame 120 (beat: land), rectangle at 312,180 size 640 by 160.",
        "Image: /path/to/project/.smoove/marks/promo-f120.png",
        "",
        '1. title (Text "Launch day"), 98% inside, box 330,196 size 600 by 120',
        "   src/compositions/promo.ts:42:17",
        "   in card, hero",
        "2. card (Flex), 71% inside, box 300,170 size 680 by 220",
        "   src/compositions/promo.ts:35:16",
        "   in hero",
      ].join("\n"),
    );
  });

  it("marks an inherited source and skips a missing one", () => {
    const mark = walkthroughMark();
    const [title, card] = mark.nodes;
    if (!title || !card) throw new Error("fixture");
    title.source = { file: "src/x.ts", line: 3, column: 1, inherited: true };
    card.source = null;
    card.ancestors = [];
    const text = formatContext({ mark });
    expect(text).toContain("   src/x.ts:3:1 (inherited)");
    expect(text.split("\n").slice(-1)[0]).toBe(
      "2. card (Flex), 71% inside, box 300,170 size 680 by 220",
    );
  });

  it("lists the closest nodes when none passed the threshold", () => {
    const mark = { ...walkthroughMark(), closest: true };
    const lines = formatContext({ mark }).split("\n");
    expect(lines[3]).toBe(
      "No node is more than 60 percent inside the rectangle. These come closest:",
    );
    expect(lines[4]).toBe('1. title (Text "Launch day"), 98% inside, box 330,196 size 600 by 120');
  });

  it("says when there's no mark", () => {
    expect(formatContext({ mark: null })).toBe(
      "No mark. Ask the user to drag a rectangle over the thing they mean in the studio.",
    );
  });

  it("says when no node passed the threshold", () => {
    const mark = { ...walkthroughMark(), nodes: [] };
    expect(formatContext({ mark }).split("\n")).toEqual([
      "Mark on promo, frame 120 (beat: land), rectangle at 312,180 size 640 by 160.",
      "Image: /path/to/project/.smoove/marks/promo-f120.png",
      "",
      "No node is more than 60 percent inside the rectangle. Look at the image.",
    ]);
  });

  it("reads and clears the mark, exiting 0 even with no mark", async () => {
    await startServer();
    const { id: _id, drawnAt: _a, drawnBy: _b, image: _i, ...rest } = walkthroughMark();
    const close = await postMarkFromTab({ id: "m1", ...rest });
    const first = io();
    expect(await main(["context"], first.io)).toBe(0);
    expect(first.out.join("\n")).toContain('1. title (Text "Launch day")');

    const json = io();
    expect(await main(["context", "--json"], json.io)).toBe(0);
    expect(JSON.parse(json.out.join(""))).toEqual({ ok: true, data: { mark: null } });

    const none = io();
    expect(await main(["context"], none.io)).toBe(0);
    expect(none.out.join("\n")).toMatch(/^No mark\./);
    close();
  });

  it("status mentions a waiting mark", () => {
    const data: StatusData = {
      server: {
        url: "http://localhost:5190/",
        pid: 1,
        startedAt: "2026-10-19T20:00:00.000Z",
        tabs: [],
        mark: { composition: "promo", frame: 120 },
      },
      studio: null,
      openUrl: "http://localhost:5190/",
    };
    expect(formatStatus(data)).toContain(
      "A mark is waiting on promo, frame 120. Run smoove context.",
    );
  });
});

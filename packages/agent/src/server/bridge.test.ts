import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  AgentResponse,
  RenderData,
  SheetData,
  SnapshotData,
  StatusData,
  TabRequest,
} from "../index.js";
import {
  type AgentBridge,
  createAgentBridge,
  isLoopbackAddress,
  sheetFileName,
  snapshotFileName,
} from "./bridge.js";
import { readDiscovery } from "./discovery.js";
import { type BrowserLauncher, NoBrowserError } from "./headless.js";

const TOKEN = "test-token";

let root: string;
let bridge: AgentBridge;
let server: Server;
let origin: string;

async function start(
  opts: { timeoutMs?: number; settleMs?: number; launchBrowser?: BrowserLauncher | false } = {},
) {
  bridge = createAgentBridge({ root, token: TOKEN, settleMs: 0, launchBrowser: false, ...opts });
  server = createServer((req, res) =>
    bridge.handle(req, res, () => {
      // Stands in for a host's render download route.
      if (req.url === "/download/clip.mp4") {
        res.writeHead(200, { "Content-Type": "video/mp4" });
        res.end(Buffer.from("fake mp4 bytes"));
        return;
      }
      res.statusCode = 404;
      res.end("not the bridge");
    }),
  );
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "smoove-agent-"));
});

afterEach(async () => {
  bridge?.close();
  server?.closeAllConnections();
  await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
  rmSync(root, { recursive: true, force: true });
});

function agent(path: string, init: RequestInit & { json?: unknown } = {}) {
  const { json, ...rest } = init;
  return fetch(`${origin}/__smoove/agent/${path}`, {
    ...rest,
    method: json !== undefined ? "POST" : (rest.method ?? "GET"),
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(rest.headers as Record<string, string>),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
}

/** A fake studio tab: an open event stream plus a way to answer requests. */
class FakeTab {
  id = "";
  readonly requests: TabRequest[] = [];
  readonly cancels: string[] = [];
  private waiters: Array<() => void> = [];
  private abort = new AbortController();

  static async connect(query: Record<string, string> = {}): Promise<FakeTab> {
    const tab = new FakeTab();
    const qs = new URLSearchParams({ path: "/c/demo", visible: "1", focused: "0", ...query });
    const res = await fetch(`${origin}/__smoove/agent/tab/connect?${qs}`, {
      signal: tab.abort.signal,
    });
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    void tab.read(res);
    await tab.until(() => tab.id !== "");
    return tab;
  }

  private async read(res: Response) {
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buf = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        buf += decoder.decode(value, { stream: true });
        let i = buf.indexOf("\n\n");
        while (i >= 0) {
          this.onBlock(buf.slice(0, i));
          buf = buf.slice(i + 2);
          i = buf.indexOf("\n\n");
        }
      }
    } catch {
      // aborted
    }
  }

  private onBlock(block: string) {
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7);
      else if (line.startsWith("data: ")) data += line.slice(6);
    }
    if (!data) return;
    const parsed = JSON.parse(data);
    if (event === "hello") this.id = parsed.tabId;
    if (event === "request") this.requests.push(parsed);
    if (event === "cancel") this.cancels.push(parsed.id);
    for (const w of this.waiters.splice(0)) w();
  }

  until(pred: () => boolean): Promise<void> {
    if (pred()) return Promise.resolve();
    return new Promise((resolve) => {
      const check = () => (pred() ? resolve() : this.waiters.push(check));
      this.waiters.push(check);
    });
  }

  async nextRequest(n = this.requests.length + 1): Promise<TabRequest> {
    await this.until(() => this.requests.length >= n);
    const req = this.requests[n - 1];
    if (!req) throw new Error("no request");
    return req;
  }

  reply(id: string, body: AgentResponse<unknown>, path = "/c/demo") {
    return fetch(`${origin}/__smoove/agent/tab/reply?req=${id}&path=${encodeURIComponent(path)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  replyPng(id: string, bytes: Uint8Array, meta: Record<string, string>) {
    const qs = new URLSearchParams({ req: id, path: "/c/demo", ...meta });
    return fetch(`${origin}/__smoove/agent/tab/reply?${qs}`, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: bytes,
    });
  }

  presence(p: { visible?: boolean; focused?: boolean }) {
    return fetch(`${origin}/__smoove/agent/tab/presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tabId: this.id,
        visible: true,
        focused: false,
        path: "/c/demo",
        ...p,
      }),
    });
  }

  close() {
    this.abort.abort();
  }
}

/** Answer every status request on a tab with a fixed studio state. */
async function answerStatus(tab: FakeTab, n = tab.requests.length + 1) {
  const req = await tab.nextRequest(n);
  expect(req.type).toBe("status");
  await tab.reply(req.id, { ok: true, data: { catalog: [], active: null } });
}

describe("token", () => {
  it("rejects a missing or wrong token with unauthorized", async () => {
    await start();
    const none = await fetch(`${origin}/__smoove/agent/status`);
    expect(none.status).toBe(401);
    expect((await none.json()).error.code).toBe("unauthorized");

    const wrong = await agent("status", { headers: { Authorization: "Bearer nope" } });
    expect(wrong.status).toBe(401);
    expect((await wrong.json()).error.code).toBe("unauthorized");
  });

  it("generates a fresh random token per bridge", () => {
    const a = createAgentBridge({ root });
    const b = createAgentBridge({ root });
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThan(20);
    a.close();
    b.close();
  });

  it("passes requests outside the prefix to next()", async () => {
    await start();
    const res = await fetch(`${origin}/c/demo`);
    expect(await res.text()).toBe("not the bridge");
  });
});

describe("origin and loopback", () => {
  it("refuses a tab request with a foreign Origin", async () => {
    await start();
    const res = await fetch(`${origin}/__smoove/agent/tab/hello`, {
      headers: { Origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("forbidden");
  });

  it("accepts a tab request from its own origin, or with no Origin", async () => {
    await start();
    const same = await fetch(`${origin}/__smoove/agent/tab/hello`, { headers: { Origin: origin } });
    expect(same.status).toBe(200);
    expect(await same.json()).toEqual({ bridge: "smoove-agent", version: 1 });
    const none = await fetch(`${origin}/__smoove/agent/tab/hello`);
    expect(none.status).toBe(200);
  });

  it("refuses a cross-site fetch metadata header", async () => {
    await start();
    const res = await fetch(`${origin}/__smoove/agent/tab/hello`, {
      headers: { "Sec-Fetch-Site": "cross-site" },
    });
    expect(res.status).toBe(403);
  });

  it("recognises loopback addresses only", () => {
    expect(isLoopbackAddress("127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("127.4.5.6")).toBe(true);
    expect(isLoopbackAddress("::1")).toBe(true);
    expect(isLoopbackAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("192.168.1.5")).toBe(false);
    expect(isLoopbackAddress("::ffff:10.0.0.2")).toBe(false);
    expect(isLoopbackAddress("fe80::1")).toBe(false);
    expect(isLoopbackAddress(undefined)).toBe(false);
  });

  it("refuses a request from another machine, even with the token", () => {
    const b = createAgentBridge({ root, token: TOKEN });
    const req = {
      url: "/__smoove/agent/status",
      method: "GET",
      headers: { authorization: `Bearer ${TOKEN}` },
      socket: { remoteAddress: "192.168.1.5" },
    } as unknown as IncomingMessage;
    let status = 0;
    let body = "";
    const res = {
      headersSent: false,
      writeHead(s: number) {
        status = s;
      },
      end(text: string) {
        body = text;
      },
    } as unknown as ServerResponse;
    b.handle(req, res);
    expect(status).toBe(403);
    expect(JSON.parse(body).error.code).toBe("forbidden");
    b.close();
  });
});

describe("discovery file", () => {
  it("is written on listening, owner-only, and removed on close", async () => {
    await start();
    const file = bridge.listening(`${origin}`);
    expect(file).toBe(join(root, ".smoove", "agent.json"));
    const info = readDiscovery(root);
    expect(info).toMatchObject({ url: `${origin}/`, token: TOKEN, pid: process.pid });
    expect(typeof info?.startedAt).toBe("string");
    expect(statSync(file).mode & 0o777).toBe(0o600);
    bridge.close();
    expect(existsSync(file)).toBe(false);
  });

  it("leaves a file that another server has since replaced", async () => {
    const a = createAgentBridge({ root, token: "a" });
    const b = createAgentBridge({ root, token: "b" });
    a.listening("http://localhost:1/");
    b.listening("http://localhost:2/");
    a.close();
    expect(readDiscovery(root)?.token).toBe("b");
    b.close();
    expect(readDiscovery(root)).toBeNull();
  });
});

describe("with no tab", () => {
  it("status answers with an empty tab list and the URL to open", async () => {
    await start();
    bridge.listening("http://localhost:5190/");
    const res = await agent("status");
    expect(res.status).toBe(200);
    const body = (await res.json()) as AgentResponse<StatusData>;
    expect(body.ok).toBe(true);
    if (!body.ok) return;
    expect(body.data.studio).toBeNull();
    expect(body.data.server.tabs).toEqual([]);
    expect(body.data.openUrl).toBe("http://localhost:5190/");
  });

  it("seek fails at once with no-tab, naming the URL", async () => {
    await start();
    bridge.listening("http://localhost:5190/");
    const res = await agent("seek", { json: { frame: 1 } });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("no-tab");
    expect(body.error.message).toContain("http://localhost:5190/");
  });

  it("snapshot without a headless browser fails with no-browser, naming the URL", async () => {
    await start();
    bridge.listening("http://localhost:5190/");
    const res = await agent("snapshot", { json: { frame: 1 } });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("no-browser");
    expect(body.error.message).toContain("http://localhost:5190/");
  });
});

describe("bad requests", () => {
  it("rejects malformed seek and snapshot bodies", async () => {
    await start();
    const cases: Array<[string, unknown]> = [
      ["seek", {}],
      ["seek", { frame: -1 }],
      ["seek", { frame: 1.5 }],
      ["seek", { frame: "3" }],
      ["seek", { frame: 3, composition: 4 }],
      ["snapshot", { width: 0 }],
      ["snapshot", { frame: -2 }],
    ];
    for (const [path, json] of cases) {
      const res = await agent(path, { json });
      expect(res.status, `${path} ${JSON.stringify(json)}`).toBe(400);
      expect((await res.json()).error.code).toBe("bad-request");
    }
    const notJson = await agent("seek", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{nope",
    });
    expect(notJson.status).toBe(400);
  });

  it("names the endpoints for an unknown path", async () => {
    await start();
    const res = await agent("render");
    expect(res.status).toBe(404);
    expect((await res.json()).error.message).toContain("snapshot");
  });
});

describe("forwarding to a tab", () => {
  it("merges the tab's studio status with the server's and names the tab", async () => {
    await start();
    const tab = await FakeTab.connect();
    const pending = agent("status");
    const req = await tab.nextRequest();
    expect(req.type).toBe("status");
    await tab.reply(req.id, {
      ok: true,
      data: { catalog: [{ id: "demo", title: "Demo", group: null }], active: null },
    });
    const res = await pending;
    const body = (await res.json()) as AgentResponse<StatusData>;
    expect(body.ok && body.data.studio?.catalog[0]?.id).toBe("demo");
    expect(body.ok && body.data.server.tabs.map((t) => t.tabId)).toEqual([tab.id]);
    expect(body.drawnBy).toEqual({
      tabId: tab.id,
      path: "/c/demo",
      visible: true,
      headless: false,
    });
    tab.close();
  });

  it("passes seek params through and relays tab errors with a matching status", async () => {
    await start();
    const tab = await FakeTab.connect();
    const pending = agent("seek", { json: { frame: 900, composition: "demo" } });
    const req = await tab.nextRequest();
    expect(req).toMatchObject({ type: "seek", params: { frame: 900, composition: "demo" } });
    await tab.reply(req.id, {
      ok: false,
      error: { code: "frame-out-of-range", message: "Frames run from 0 to 299." },
    });
    const res = await pending;
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("frame-out-of-range");
    tab.close();
  });

  it("defaults the snapshot width to 640", async () => {
    await start();
    const tab = await FakeTab.connect();
    const pending = agent("snapshot", { json: {} });
    const req = await tab.nextRequest();
    expect(req).toMatchObject({ type: "snapshot", params: { width: 640 } });
    await tab.reply(req.id, { ok: false, error: { code: "not-active", message: "x" } });
    expect((await pending).status).toBe(409);
    tab.close();
  });

  it("times out with tab-timeout and tells the tab to cancel", async () => {
    await start({ timeoutMs: 60 });
    const tab = await FakeTab.connect();
    const res = await agent("seek", { json: { frame: 1 } });
    expect(res.status).toBe(504);
    const body = await res.json();
    expect(body.error.code).toBe("tab-timeout");
    expect(body.drawnBy.tabId).toBe(tab.id);
    const req = await tab.nextRequest(1);
    await tab.until(() => tab.cancels.includes(req.id));
    // A late reply is refused rather than delivered anywhere.
    expect((await tab.reply(req.id, { ok: true, data: null })).status).toBe(404);
    tab.close();
  });

  it("fails a pending request when its tab disconnects", async () => {
    await start();
    const tab = await FakeTab.connect();
    const pending = agent("seek", { json: { frame: 1 } });
    await tab.nextRequest();
    tab.close();
    const res = await pending;
    expect((await res.json()).error.code).toBe("tab-error");
    await expect.poll(() => bridge.tabs().length).toBe(0);
  });

  it("holds requests briefly right after a file change", async () => {
    await start({ settleMs: 80 });
    const tab = await FakeTab.connect();
    bridge.fileChanged();
    const t0 = Date.now();
    const pending = agent("status");
    const req = await tab.nextRequest();
    expect(Date.now() - t0).toBeGreaterThanOrEqual(60);
    await tab.reply(req.id, { ok: true, data: { catalog: [], active: null } });
    await pending;
    tab.close();
  });
});

describe("picking a tab", () => {
  it("prefers the most recently focused tab", async () => {
    await start();
    const a = await FakeTab.connect({ focused: "1" });
    const b = await FakeTab.connect();
    const first = agent("status");
    await answerStatus(a);
    expect((await (await first).json()).drawnBy.tabId).toBe(a.id);

    await b.presence({ focused: true });
    await a.presence({ focused: false });
    const second = agent("status");
    await answerStatus(b);
    expect((await (await second).json()).drawnBy.tabId).toBe(b.id);
    a.close();
    b.close();
  });

  it("falls back to the most recently connected tab when none has had focus", async () => {
    await start();
    const a = await FakeTab.connect({ headless: "1" });
    const b = await FakeTab.connect({ headless: "1" });
    const pending = agent("status");
    await answerStatus(b);
    const body = await (await pending).json();
    expect(body.drawnBy).toMatchObject({ tabId: b.id, headless: true });
    expect(a.requests).toHaveLength(0);
    a.close();
    b.close();
  });

  it("drops a tab whose stream closes", async () => {
    await start();
    const a = await FakeTab.connect({ focused: "1" });
    const b = await FakeTab.connect();
    a.close();
    await expect.poll(() => bridge.tabs().map((t) => t.tabId)).toEqual([b.id]);
    b.close();
  });
});

describe("snapshots", () => {
  it("writes the PNG bytes under .smoove/snaps and answers with the absolute path", async () => {
    await start();
    const tab = await FakeTab.connect();
    const pending = agent("snapshot", { json: { frame: 120 } });
    const req = await tab.nextRequest();
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const meta = { composition: "hello-smoove", frame: "120", width: "640", height: "360" };
    expect((await tab.replyPng(req.id, bytes, meta)).status).toBe(200);
    const body = (await (await pending).json()) as AgentResponse<SnapshotData>;
    expect(body.ok).toBe(true);
    if (!body.ok) return;
    const want = join(root, ".smoove", "snaps", "hello-smoove-f120-w640.png");
    expect(body.data).toEqual({
      path: want,
      composition: "hello-smoove",
      frame: 120,
      width: 640,
      height: 360,
    });
    expect(new Uint8Array(readFileSync(want))).toEqual(bytes);

    // The same request overwrites the same file.
    const again = agent("snapshot", { json: { frame: 120 } });
    const req2 = await tab.nextRequest(2);
    await tab.replyPng(req2.id, new Uint8Array([9]), meta);
    await again;
    expect(new Uint8Array(readFileSync(want))).toEqual(new Uint8Array([9]));
    tab.close();
  });

  it("names files safely", () => {
    expect(snapshotFileName("hello-smoove", 120, 640)).toBe("hello-smoove-f120-w640.png");
    expect(snapshotFileName("../../etc/passwd", 0, 1)).toBe("..-..-etc-passwd-f0-w1.png");
    expect(snapshotFileName("a b/c", 3, 10)).toBe("a-b-c-f3-w10.png");
  });
});

/** A fake headless browser: records the URL and lets the test connect its tab. */
function fakeLauncher() {
  const launched: string[] = [];
  let closed = 0;
  const launcher: BrowserLauncher = (url) => {
    launched.push(url);
    return {
      exited: new Promise<void>(() => {}),
      close: () => {
        closed++;
      },
    };
  };
  return {
    launcher,
    launched,
    closed: () => closed,
    /** Connect the page the browser opened, as the studio would. */
    async connectOwned(query: Record<string, string> = {}) {
      const at = launched.at(-1);
      if (!at) throw new Error("nothing launched");
      const secret = new URL(at).searchParams.get("smoove-agent-tab") ?? "";
      return FakeTab.connect({ "smoove-agent-tab": secret, ...query });
    },
  };
}

describe("routing by composition", () => {
  it("sends a request about the composition a user tab shows to that tab", async () => {
    await start();
    const user = await FakeTab.connect({ composition: "intro" });
    const pending = agent("snapshot", { json: { composition: "intro" } });
    const req = await user.nextRequest();
    expect(req.type).toBe("snapshot");
    expect(req.params).toMatchObject({ composition: "intro", maySwitch: false });
    await user.reply(req.id, { ok: false, error: { code: "tab-error", message: "x" } });
    await pending;
    user.close();
  });

  it("opens the headless tab for a composition no user tab shows, and leaves the user's tab alone", async () => {
    const fake = fakeLauncher();
    await start({ launchBrowser: fake.launcher });
    bridge.listening(origin);
    const user = await FakeTab.connect({ composition: "intro" });
    const pending = agent("sheet", { json: { composition: "outro" } });
    await new Promise<void>((r) => {
      const wait = () => (fake.launched.length > 0 ? r() : setTimeout(wait, 5));
      wait();
    });
    expect(fake.launched[0]).toMatch(/smoove-agent-tab=/);
    const owned = await fake.connectOwned();
    // The request may already be in by now, so ask for the first one by number.
    const req = await owned.nextRequest(1);
    expect(req.type).toBe("sheet");
    expect(req.params).toMatchObject({ composition: "outro", maySwitch: true, width: 320 });
    await owned.reply(req.id, { ok: false, error: { code: "tab-error", message: "x" } });
    const body = await (await pending).json();
    expect(body.drawnBy.headless).toBe(true);
    expect(user.requests).toHaveLength(0);

    // The headless tab stays: the next request reuses it, with no second launch.
    const again = agent("timeline", { json: { composition: "outro" } });
    const req2 = await owned.nextRequest(2);
    expect(req2.type).toBe("timeline");
    await owned.reply(req2.id, { ok: false, error: { code: "tab-error", message: "x" } });
    await again;
    expect(fake.launched).toHaveLength(1);

    bridge.close();
    expect(fake.closed()).toBe(1);
    user.close();
    owned.close();
  });

  it("follows a user tab that switches compositions", async () => {
    await start();
    const user = await FakeTab.connect({ composition: "intro" });
    await fetch(`${origin}/__smoove/agent/tab/presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tabId: user.id,
        visible: true,
        focused: false,
        path: "/c/outro",
        composition: "outro",
      }),
    });
    expect(bridge.tabs()[0]?.composition).toBe("outro");
    const pending = agent("snapshot", { json: { composition: "outro" } });
    const req = await user.nextRequest();
    await user.reply(req.id, { ok: false, error: { code: "tab-error", message: "x" } });
    await pending;
    user.close();
  });

  it("never seeks the headless tab, and status ignores it", async () => {
    const fake = fakeLauncher();
    await start({ launchBrowser: fake.launcher });
    bridge.listening(origin);
    const pending = agent("snapshot", { json: {} });
    await new Promise<void>((r) => {
      const wait = () => (fake.launched.length > 0 ? r() : setTimeout(wait, 5));
      wait();
    });
    const owned = await fake.connectOwned();
    const req = await owned.nextRequest(1);
    expect(req.params).toMatchObject({ maySwitch: true });
    await owned.reply(req.id, { ok: false, error: { code: "tab-error", message: "x" } });
    await pending;

    const seek = await agent("seek", { json: { frame: 3 } });
    expect(seek.status).toBe(409);
    expect((await seek.json()).error.code).toBe("no-tab");

    const status = (await (await agent("status")).json()) as AgentResponse<StatusData>;
    expect(status.ok && status.data.studio).toBeNull();
    expect(status.ok && status.data.server.tabs[0]?.owned).toBe(true);
    expect(owned.requests).toHaveLength(1);
    owned.close();
  });

  it("answers no-browser when no browser can be launched", async () => {
    await start({
      launchBrowser: () => {
        throw new NoBrowserError("No Chrome here.");
      },
    });
    bridge.listening("http://localhost:5190/");
    const res = await agent("timeline", { json: {} });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("no-browser");
    expect(body.error.message).toContain("No Chrome here.");
    expect(body.error.message).toContain("SMOOVE_BROWSER");
  });
});

describe("sheets", () => {
  it("writes the sheet under .smoove/sheets and passes warnings through", async () => {
    await start();
    const tab = await FakeTab.connect();
    const pending = agent("sheet", { json: {} });
    const req = await tab.nextRequest();
    const meta = {
      composition: "promo",
      mode: "beats",
      tileWidth: 320,
      tileHeight: 180,
      width: 1000,
      height: 400,
      tiles: [
        { frame: 74, beat: "hook" },
        { frame: 149, beat: "land" },
      ],
    };
    await tab.replyPng(req.id, new Uint8Array([1, 2]), {
      kind: "sheet",
      meta: JSON.stringify(meta),
      warnings: JSON.stringify(["video left out"]),
    });
    const body = (await (await pending).json()) as AgentResponse<SheetData>;
    expect(body.ok).toBe(true);
    if (!body.ok) return;
    const want = join(root, ".smoove", "sheets", "promo-beats-w320.png");
    expect(body.data).toEqual({ path: want, ...meta });
    expect(body.warnings).toEqual(["video left out"]);
    expect(existsSync(want)).toBe(true);
    tab.close();
  });

  it("validates frames and width", async () => {
    await start();
    for (const json of [{ frames: 1 }, { frames: 25 }, { width: 10 }, { composition: "" }]) {
      const res = await agent("sheet", { json });
      expect(res.status).toBe(400);
    }
    expect(sheetFileName("promo", "even", 6, 320)).toBe("promo-even6-w320.png");
  });
});

describe("renders", () => {
  it("queues through a user tab, follows progress, and saves the file", async () => {
    await start();
    bridge.listening(origin);
    const tab = await FakeTab.connect({ composition: "clip" });
    const pending = agent("render", { json: { composition: "clip" } });
    const req = await tab.nextRequest();
    expect(req.type).toBe("render");
    expect(req.params).toMatchObject({ composition: "clip", format: "mp4" });
    await tab.reply(req.id, {
      ok: true,
      data: { jobId: "job-1", composition: "clip", format: "mp4" },
    });
    const queued = (await (await pending).json()) as AgentResponse<RenderData>;
    expect(queued.ok && queued.data.status).toBe("queued");
    const out = join(root, "out", "clip.mp4");
    expect(queued.ok && queued.data.out).toBe(out);

    const job = (update: Record<string, unknown>) =>
      fetch(`${origin}/__smoove/agent/tab/job`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabId: tab.id, jobId: "job-1", ...update }),
      });
    expect((await job({ status: "rendering", progress: 0.5 })).status).toBe(200);
    let state = (await (await agent("render/job-1")).json()) as AgentResponse<RenderData>;
    expect(state.ok && state.data).toMatchObject({ status: "rendering", progress: 0.5 });

    await job({ status: "done", progress: 1, result: "/download/clip.mp4" });
    for (let i = 0; i < 50; i++) {
      state = (await (await agent("render/job-1")).json()) as AgentResponse<RenderData>;
      if (state.ok && state.data.status === "done") break;
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(state.ok && state.data.status).toBe("done");
    expect(readFileSync(out, "utf8")).toBe("fake mp4 bytes");
    tab.close();
  });

  it("marks a job failed when its tab closes mid-render", async () => {
    await start();
    const tab = await FakeTab.connect();
    const pending = agent("render", { json: {} });
    const req = await tab.nextRequest();
    await tab.reply(req.id, {
      ok: true,
      data: { jobId: "job-2", composition: "c", format: "webm" },
    });
    await pending;
    tab.close();
    let state: AgentResponse<RenderData> | null = null;
    for (let i = 0; i < 50; i++) {
      state = (await (await agent("render/job-2")).json()) as AgentResponse<RenderData>;
      if (state.ok && state.data.status === "error") break;
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(state?.ok && state.data.status).toBe("error");
  });

  it("refuses an output path outside the project and a half range", async () => {
    await start();
    for (const json of [
      { out: "/etc/x.mp4" },
      { out: "../x.mp4" },
      { from: 3 },
      { format: "gif" },
    ]) {
      const res = await agent("render", { json });
      expect(res.status).toBe(400);
    }
  });
});

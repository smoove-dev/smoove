import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AgentResponse, SnapshotData, StatusData, TabRequest } from "../index.js";
import {
  type AgentBridge,
  createAgentBridge,
  isLoopbackAddress,
  snapshotFileName,
} from "./bridge.js";
import { readDiscovery } from "./discovery.js";

const TOKEN = "test-token";

let root: string;
let bridge: AgentBridge;
let server: Server;
let origin: string;

async function start(opts: { timeoutMs?: number; settleMs?: number } = {}) {
  bridge = createAgentBridge({ root, token: TOKEN, settleMs: 0, ...opts });
  server = createServer((req, res) =>
    bridge.handle(req, res, () => {
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

  it("seek and snapshot fail at once with no-tab, naming the URL", async () => {
    await start();
    bridge.listening("http://localhost:5190/");
    for (const path of ["seek", "snapshot"]) {
      const res = await agent(path, { json: { frame: 1 } });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe("no-tab");
      expect(body.error.message).toContain("http://localhost:5190/");
    }
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

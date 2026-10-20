/**
 * A real bridge on a loopback port with fake studio tabs, for testing the
 * commands and the MCP server without a browser.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TabRequest } from "@smoove/agent";
import type { BrowserLauncher } from "@smoove/agent/server";
import { type AgentBridge, createAgentBridge } from "@smoove/agent/server";

export interface Answer {
  body: BodyInit;
  type: string;
  query?: Record<string, string>;
}

/** A temporary project folder with a package.json. */
export function tempProject(): { root: string; remove(): void } {
  const root = mkdtempSync(join(tmpdir(), "smoove-mcp-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { dev: "vite" } }));
  return { root, remove: () => rmSync(root, { recursive: true, force: true }) };
}

export interface FakeBridge {
  origin: string;
  bridge: AgentBridge;
  /** Every request a tab received, in order. */
  requests: TabRequest[];
  /** The id of the headless tab, once it connected. */
  tabId(): string;
  close(): Promise<void>;
}

export interface FakeTab {
  close(): void;
  id(): string;
}

/**
 * Start a bridge for `root`. With `answer`, its own headless tab (launched on
 * demand) answers every request with it, the way the real headless tab does.
 */
export async function startBridge(
  root: string,
  answer?: (req: TabRequest) => Answer,
): Promise<FakeBridge> {
  const requests: TabRequest[] = [];
  const closers: Array<() => void> = [];
  let tab: FakeTab | null = null;
  let origin = "";
  const launcher: BrowserLauncher | false = answer
    ? (url) => {
        const secret = new URL(url).searchParams.get("smoove-agent-tab") ?? "";
        void connectTab(() => origin, answer, requests, { "smoove-agent-tab": secret }).then(
          (t) => {
            tab = t;
            closers.push(t.close);
          },
        );
        return { exited: new Promise<void>(() => {}), close: () => {} };
      }
    : false;
  const bridge = createAgentBridge({ root, settleMs: 0, launchBrowser: launcher });
  const server: Server = createServer((req, res) => bridge.handle(req, res, () => res.end()));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  bridge.listening(origin);
  return {
    origin,
    bridge,
    requests,
    tabId: () => tab?.id() ?? "",
    async close() {
      for (const c of closers) c();
      bridge.close();
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
    },
  };
}

/** A studio tab that answers every request with `answer`. */
export async function connectTab(
  origin: () => string,
  answer: (req: TabRequest) => Answer,
  requests: TabRequest[],
  query: Record<string, string> = {},
): Promise<FakeTab> {
  const abort = new AbortController();
  let id = "";
  const qs = new URLSearchParams({ path: "/c/promo", composition: "promo", ...query });
  const res = await fetch(`${origin()}/__smoove/agent/tab/connect?${qs}`, { signal: abort.signal });
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
          if (block.startsWith("event: hello")) {
            id = (JSON.parse(block.split("data: ")[1] ?? "{}") as { tabId: string }).tabId;
            continue;
          }
          if (!block.startsWith("event: request")) continue;
          const req = JSON.parse(block.split("data: ")[1] ?? "{}") as TabRequest;
          requests.push(req);
          const a = answer(req);
          const replyQs = new URLSearchParams({ req: req.id, ...a.query });
          await fetch(`${origin()}/__smoove/agent/tab/reply?${replyQs}`, {
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
  while (!id) await new Promise((r) => setTimeout(r, 2));
  return { close: () => abort.abort(), id: () => id };
}

/** A one-pixel PNG, for snapshot and sheet answers. */
export const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
  ),
);

export const json = (data: unknown): Answer => ({
  body: JSON.stringify({ ok: true, data }),
  type: "application/json",
});

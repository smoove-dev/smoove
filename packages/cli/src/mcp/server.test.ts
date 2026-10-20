import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import type { CheckData, TabRequest } from "@smoove/agent";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { COMMANDS, type RunContext } from "../commands.js";
import {
  type Answer,
  type FakeBridge,
  json,
  PNG,
  startBridge,
  tempProject,
} from "../test/fake-bridge.js";
import { createMcpServer, toToolResult } from "./server.js";

type Content = { type: string; text?: string; data?: string; mimeType?: string };
type ToolResult = { content: Content[]; structuredContent?: unknown; isError?: boolean };

let project: ReturnType<typeof tempProject>;
let fake: FakeBridge | null = null;
let client: Client;

beforeEach(() => {
  project = tempProject();
});
afterEach(async () => {
  await client?.close();
  await fake?.close();
  fake = null;
  project.remove();
});

async function connect(): Promise<Client> {
  const base: Omit<RunContext, "door" | "progress"> = {
    cwd: project.root,
    env: {},
    sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 5))),
  };
  const server = createMcpServer(base, "0.0.0-test");
  const [clientEnd, serverEnd] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "smoove-test", version: "1.0.0" });
  await server.connect(serverEnd);
  await client.connect(clientEnd);
  return client;
}

const call = (name: string, args: Record<string, unknown> = {}) =>
  client.callTool({ name, arguments: args }) as Promise<ToolResult>;

const snapAnswer = (): Answer => ({
  body: PNG,
  type: "image/png",
  query: { kind: "snapshot", composition: "promo", frame: "12", width: "640", height: "360" },
});

function checkData(images: string[]): CheckData {
  return {
    composition: "promo",
    catalog: ["promo"],
    hasChecksFile: true,
    hasPalette: true,
    frames: 300,
    beats: 2,
    samples: 100,
    findings: images.map((image, i) => ({
      code: "layout/off-canvas",
      severity: "warning",
      held: true,
      message: `finding ${i}`,
      composition: "promo",
      node: null,
      frames: [{ from: 0, to: 9 }],
      beats: [],
      source: null,
      image,
    })),
    allowed: [],
    colorsInUse: [],
  };
}

describe("the smoove MCP server", () => {
  it("lists one tool per command, with its description and hints", async () => {
    await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(COMMANDS.map((c) => c.name));
    for (const t of tools) {
      const c = COMMANDS.find((x) => x.name === t.name);
      expect(t.description).toBe(c?.description);
      expect(t.annotations?.readOnlyHint ?? false).toBe(c?.annotations.readOnlyHint ?? false);
      expect(t.inputSchema.type).toBe("object");
    }
  });

  it("returns a snap's text and its image inline, with no structured content", async () => {
    fake = await startBridge(project.root, snapAnswer);
    await connect();
    const r = await call("snap", { frame: 12 });
    expect(r.isError).toBeFalsy();
    const path = join(project.root, ".smoove", "snaps", "promo-f12-w640.png");
    expect(r.content[0]?.type).toBe("text");
    expect(r.content[0]?.text).toContain(path);
    const image = r.content.find((c) => c.type === "image");
    expect(image?.mimeType).toBe("image/png");
    expect(Buffer.from(image?.data ?? "", "base64")).toEqual(readFileSync(path));
    // Claude Code shows structured content to the model in place of the text,
    // so the tools send the text alone.
    expect(r.structuredContent).toBeUndefined();
  });

  it("inlines the mark only when asked", async () => {
    fake = await startBridge(project.root, snapAnswer);
    await connect();
    await call("snap", { frame: 1 });
    let n = 0;
    const post = async () => {
      n += 1;
      const id = `m${n}`;
      const qs = new URLSearchParams({
        tabId: fake?.tabId() ?? "",
        id,
        composition: "promo",
        frame: "3",
      });
      await fetch(`${fake?.origin}/__smoove/agent/tab/mark-image?${qs}`, {
        method: "POST",
        body: PNG,
      });
      await fetch(`${fake?.origin}/__smoove/agent/tab/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tabId: fake?.tabId(),
          mark: {
            id,
            composition: "promo",
            frame: 3,
            beat: null,
            rect: { x: 0, y: 0, width: 5, height: 5 },
            nodes: [],
          },
        }),
      });
    };
    await post();
    const plain = await call("context");
    expect(plain.content.filter((c) => c.type === "image")).toHaveLength(0);
    expect(plain.content[0]?.text).toContain("Image: ");
    await post();
    const inlined = await call("context", { image: true });
    expect(inlined.content.filter((c) => c.type === "image")).toHaveLength(1);
  });

  it("lists a check's image paths and never inlines them, with every report in one block", async () => {
    const paths = [join(project.root, "a.png"), join(project.root, "b.png")];
    fake = await startBridge(project.root, (req: TabRequest) =>
      json(req.type === "check" ? { ...checkData(paths), catalog: ["promo", "intro"] } : {}),
    );
    await connect();
    const r = await call("check", { images: true, all: true });
    expect(r.content.filter((c) => c.type === "image")).toHaveLength(0);
    expect(r.content.filter((c) => c.type === "text")).toHaveLength(1);
    for (const p of paths) expect(r.content[0]?.text).toContain(`Image: ${p}`);
    expect((r.content[0]?.text?.match(/^Checked /gm) ?? []).length).toBe(2);
  });

  it("names the start tool when no dev server runs, and stays up", async () => {
    await connect();
    const r = await call("snap");
    expect(r.isError).toBe(true);
    expect(r.content[0]?.text).toContain("the start tool");
    const again = await call("timeline");
    expect(again.isError).toBe(true);
  });

  it("answers bad input with the command's message, as a tool error", async () => {
    await connect();
    const seek = await call("seek", { frame: 1.5 });
    expect(seek.isError).toBe(true);
    const render = await call("render", { from: 1 });
    expect(render.isError).toBe(true);
    expect(render.content[0]?.text).toContain("Give both --from and --to, or neither.");
    const check = await call("check", { groups: ["nope"] });
    expect(check.isError).toBe(true);
  });

  it("sends render progress the client sees", async () => {
    let origin = "";
    fake = await startBridge(project.root, (req) => {
      if (req.type !== "render") return json({});
      const post = (body: Record<string, unknown>) =>
        fetch(`${origin}/__smoove/agent/tab/job`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tabId: fake?.tabId(), jobId: "j1", ...body }),
        });
      setTimeout(() => void post({ status: "rendering", progress: 0.5 }).catch(() => {}), 20);
      setTimeout(
        () => void post({ status: "done", progress: 1, result: "/download/x.mp4" }).catch(() => {}),
        60,
      );
      return json({ jobId: "j1", composition: "promo", format: "mp4" });
    });
    origin = fake.origin;
    await connect();
    const seen: number[] = [];
    const r = (await client.callTool(
      { name: "render", arguments: { composition: "promo" } },
      { onprogress: (p) => seen.push(p.progress) },
    )) as ToolResult;
    expect(r.isError).toBeFalsy();
    expect(seen.length).toBeGreaterThan(1);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });

  it("answers two calls at once", async () => {
    fake = await startBridge(project.root, (req) =>
      req.type === "snapshot"
        ? snapAnswer()
        : json({
            composition: "promo",
            width: 640,
            height: 360,
            fps: 30,
            durationInFrames: 60,
            beatsFrom: "sequences",
            beats: [],
            sequences: [],
          }),
    );
    await connect();
    const [a, b] = await Promise.all([call("snap", { frame: 12 }), call("timeline")]);
    expect(a.isError).toBeFalsy();
    expect(b.isError).toBeFalsy();
  });
});

describe("toToolResult", () => {
  it("leaves out an image it can't read, and says so", () => {
    const r = toToolResult({
      code: 0,
      answer: { ok: true, data: {} },
      text: "a snap",
      errors: "",
      images: [{ path: "/no/such/file.png", inline: true }],
    });
    expect(r.content.filter((c) => c.type === "image")).toHaveLength(0);
    const text = r.content[0]?.type === "text" ? r.content[0].text : "";
    expect(text).toContain("a snap");
    expect(text).toContain("couldn't be read");
  });
});

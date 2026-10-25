import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import type { CutPlan } from "@smoove/agent";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RunContext } from "../commands.js";
import { tempProject } from "../test/fake-bridge.js";
import { writeMp4 } from "../test/media-fixtures.js";
import { createMcpServer } from "./server.js";

type ToolResult = {
  content: ({ type: "text"; text: string } | { type: "image"; data: string; mimeType: string })[];
  isError?: boolean;
};

let project: ReturnType<typeof tempProject>;
let outside: string;
let client: Client;

beforeEach(async () => {
  project = tempProject();
  outside = mkdtempSync(join(tmpdir(), "smoove-mcp-media-"));
  const base: Omit<RunContext, "door" | "progress"> = {
    cwd: project.root,
    // An empty model cache, so this test doesn't depend on what's installed here.
    env: { SMOOVE_CACHE_DIR: join(outside, "cache") },
    sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 5))),
  };
  const server = createMcpServer(base, "0.0.0-test");
  const [clientEnd, serverEnd] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "smoove-test", version: "1.0.0" });
  await server.connect(serverEnd);
  await client.connect(clientEnd);
});

afterEach(async () => {
  await client.close();
  project.remove();
  rmSync(outside, { recursive: true, force: true });
});

const call = (name: string, args: Record<string, unknown> = {}) =>
  client.callTool({ name, arguments: args }) as Promise<ToolResult>;
const text = (r: ToolResult) =>
  r.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join("\n");

describe("the media tools over MCP", () => {
  it("take a recording from footage_add to a cut plan", async () => {
    const original = join(outside, "talk.mp4");
    await writeMp4(original, {
      seconds: 6,
      fps: 10,
      width: 160,
      height: 90,
      color: (t) => (t < 3 ? [200, 60, 60] : [60, 60, 200]),
      audio: {
        loud: [
          { start: 0, end: 2.5 },
          { start: 3.5, end: 6 },
        ],
      },
    });

    const added = await call("footage_add", { path: original });
    expect(added.isError).toBeUndefined();
    expect(text(added)).toContain("footage/talk.mp4");

    expect(text(await call("media_info", { source: "footage/talk.mp4" }))).toContain("160 by 90");
    expect(text(await call("media_audio", { source: "footage/talk.mp4" }))).toContain(
      "Quiet: 1 stretch",
    );

    const sheet = await call("media_sheet", { source: "footage/talk.mp4", tiles: 2 });
    expect(sheet.content.some((c) => c.type === "image" && c.mimeType === "image/png")).toBe(true);

    const nothing = await call("transcribe", { source: "footage/talk.mp4" });
    expect(nothing.isError).toBe(true);
    expect(text(nothing)).toContain("If your own tools can transcribe");

    expect(
      (await call("new", { title: "Talk short", template: "recut", source: "footage/talk.mp4" }))
        .isError,
    ).toBeUndefined();
    const planned = await call("cut_plan", {
      composition: "talk-short",
      keep: [{ start: 0.5, end: 2, label: "the hook" }],
    });
    expect(planned.isError).toBeUndefined();
    const plan = JSON.parse(
      readFileSync(join(project.root, "compositions/talk-short/cuts.json"), "utf8"),
    ) as CutPlan;
    expect(plan.segments).toEqual([{ start: 0.5, end: 2, label: "the hook" }]);
    expect(readFileSync(original)).toEqual(readFileSync(join(project.root, "footage/talk.mp4")));
  });
});

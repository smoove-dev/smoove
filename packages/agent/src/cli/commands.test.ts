import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type Answer,
  type FakeBridge,
  json,
  PNG,
  startBridge,
  tempProject,
} from "../test/fake-bridge.js";
import { COMMANDS, type Command, commandNamed, type RunContext } from "./commands.js";
import { argsToInput, main } from "./main.js";

describe("the command table", () => {
  it("holds the ten commands, in order", () => {
    expect(COMMANDS.map((c) => c.name)).toEqual([
      "status",
      "start",
      "stop",
      "seek",
      "snap",
      "sheet",
      "timeline",
      "context",
      "check",
      "render",
      "render_status",
    ]);
  });

  it("gives every command a summary, a description, an input schema and hints", () => {
    for (const c of COMMANDS) {
      expect(c.summary.length, c.name).toBeGreaterThan(0);
      expect(c.description.length, c.name).toBeGreaterThan(0);
      expect(typeof c.input.safeParse, c.name).toBe("function");
      expect(c.annotations, c.name).toBeDefined();
    }
  });

  it("marks only the looking commands read-only", () => {
    const readOnly = COMMANDS.filter((c) => c.annotations.readOnlyHint === true).map((c) => c.name);
    expect(readOnly).toEqual(["status", "snap", "sheet", "timeline", "check", "render_status"]);
    expect(commandNamed("render")?.annotations.openWorldHint).toBe(true);
  });

  it("says when to seek and when to render", () => {
    expect(commandNamed("seek")?.description).toContain("only when the user asks");
    expect(commandNamed("render")?.description).toContain("only when the user asks");
  });

  it("finds a command by name", () => {
    expect(commandNamed("snap")?.name).toBe("snap");
    expect(commandNamed("nope")).toBeUndefined();
  });
});

describe("running the commands", () => {
  let project: ReturnType<typeof tempProject>;
  let fake: FakeBridge | null = null;
  beforeEach(() => {
    project = tempProject();
  });
  afterEach(async () => {
    await fake?.close();
    fake = null;
    project.remove();
  });

  const ctx = (over: Partial<RunContext> = {}): RunContext => ({
    cwd: project.root,
    env: {},
    sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 5))),
    door: "cli",
    ...over,
  });
  const run = (name: string, input: Record<string, unknown>, c = ctx()) =>
    (commandNamed(name) as Command).run(c, input);

  const snapAnswer = (): Answer => ({
    body: PNG,
    type: "image/png",
    query: { kind: "snapshot", composition: "promo", frame: "12", width: "640", height: "360" },
  });
  const sheetMeta = {
    composition: "promo",
    mode: "beats",
    tileWidth: 320,
    tileHeight: 180,
    width: 1280,
    height: 180,
    tiles: [{ frame: 10, beat: "hook" }],
  };

  it("returns a snap's image to inline", async () => {
    fake = await startBridge(project.root, snapAnswer);
    const r = await run("snap", { frame: 12 });
    expect(r.code).toBe(0);
    const path = join(project.root, ".smoove", "snaps", "promo-f12-w640.png");
    expect(r.text).toContain(path);
    expect(r.images).toEqual([{ path, inline: true }]);
  });

  it("returns a sheet's image to inline", async () => {
    fake = await startBridge(project.root, () => ({
      body: PNG,
      type: "image/png",
      query: { kind: "sheet", meta: JSON.stringify(sheetMeta) },
    }));
    const r = await run("sheet", {});
    expect(r.code).toBe(0);
    expect(r.images).toHaveLength(1);
    expect(r.images[0]?.inline).toBe(true);
  });

  it("inlines the mark's image only when asked", async () => {
    fake = await startBridge(project.root, snapAnswer);
    await run("snap", { frame: 1 }); // launches the headless tab, which posts the mark
    const mark = {
      id: "m1",
      composition: "promo",
      frame: 12,
      beat: null,
      rect: { x: 0, y: 0, width: 10, height: 10 },
      nodes: [],
    };
    let n = 0;
    const post = async () => {
      n += 1;
      const id = `m${n}`;
      const qs = new URLSearchParams({
        tabId: fake?.tabId() ?? "",
        id,
        composition: "promo",
        frame: "12",
      });
      await fetch(`${fake?.origin}/__smoove/agent/tab/mark-image?${qs}`, {
        method: "POST",
        body: PNG,
      });
      await fetch(`${fake?.origin}/__smoove/agent/tab/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabId: fake?.tabId(), mark: { ...mark, id } }),
      });
    };
    await post();
    const plain = await run("context", {});
    expect(plain.images.map((i) => i.inline)).toEqual([false]);
    await post();
    const inlined = await run("context", { image: true });
    expect(inlined.images.map((i) => i.inline)).toEqual([true]);
  });

  it("names the next step for each front door when no dev server runs", async () => {
    const cli = await run("snap", {});
    expect(cli.code).toBe(1);
    expect(cli.errors).toContain("smoove start");
    const mcp = await run("snap", {}, ctx({ door: "mcp" }));
    expect(mcp.errors).toContain("the start tool");
  });

  it("returns once a render is queued, or reports progress while it waits", async () => {
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
    const queued = await run("render", { composition: "promo", wait: false });
    expect(queued.code).toBe(0);
    expect(queued.text).toContain("Queued render j1");

    const seen: number[] = [];
    const done = await run(
      "render",
      { composition: "promo" },
      ctx({ progress: (u) => seen.push(u.progress) }),
    );
    expect(done.code).toBe(0);
    expect(seen.length).toBeGreaterThan(1);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });
});

describe("long renders", () => {
  let project: ReturnType<typeof tempProject>;
  let fake: FakeBridge | null = null;
  beforeEach(() => {
    project = tempProject();
  });
  afterEach(async () => {
    await fake?.close();
    fake = null;
    project.remove();
  });

  it("hands back the job after the wait limit, and render_status follows it", async () => {
    let origin = "";
    fake = await startBridge(project.root, (req) => {
      if (req.type !== "render") return json({});
      setTimeout(
        () =>
          void fetch(`${origin}/__smoove/agent/tab/job`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tabId: fake?.tabId(),
              jobId: "j9",
              status: "rendering",
              progress: 0.3,
            }),
          }).catch(() => {}),
        5,
      );
      return json({ jobId: "j9", composition: "promo", format: "mp4" });
    });
    origin = fake.origin;
    const c: RunContext = {
      cwd: project.root,
      env: {},
      sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 5))),
      door: "mcp",
      maxWaitMs: 40,
    };
    const r = await (commandNamed("render") as Command).run(c, { composition: "promo" });
    expect(r.code).toBe(0);
    expect(r.text).toContain("still rendering");
    expect(r.text).toContain("render_status");
    expect(r.text).toContain("j9");

    const s = await (commandNamed("render_status") as Command).run(c, { job: "j9" });
    expect(s.code).toBe(0);
    expect(s.text).toContain("30 percent");
  });
});

describe("argsToInput", () => {
  it("maps flags and positionals onto a command's input", () => {
    expect(argsToInput("seek", {}, ["120"])).toEqual({ frame: 120 });
    expect(argsToInput("render_status", {}, ["j9"])).toEqual({ job: "j9" });
    expect(argsToInput("check", { only: "layout,style" }, [])).toEqual({
      groups: ["layout", "style"],
    });
    expect(argsToInput("render", { "no-wait": true, comp: "promo" }, [])).toEqual({
      composition: "promo",
      wait: false,
    });
  });

  it("refuses a bad value with the command line's message", () => {
    expect(() => argsToInput("snap", { frame: "x" }, [])).toThrow(
      "--frame must be a whole number.",
    );
    expect(() => argsToInput("check", { only: "nope" }, [])).toThrow(/--only takes some of/);
  });
});

describe("smoove --help", () => {
  it("lists every command and smoove mcp", async () => {
    const out: string[] = [];
    const code = await main(["--help"], {
      cwd: "/",
      out: (t) => out.push(t),
      err: () => {},
      sleep: () => Promise.resolve(),
      env: {},
    });
    expect(code).toBe(0);
    for (const c of COMMANDS) expect(out[0]).toContain(`smoove ${c.name}`);
    expect(out[0]).toContain("smoove mcp");
  });
});

import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { COMMANDS, type Command, commandNamed, type RunContext, spell } from "./commands.js";
import { argsToInput, main } from "./main.js";
import {
  type Answer,
  type FakeBridge,
  json,
  PNG,
  startBridge,
  tempProject,
} from "./test/fake-bridge.js";

describe("the command table", () => {
  it("holds the twenty-six commands, in order", () => {
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
      "new",
      "footage_add",
      "media_info",
      "media_audio",
      "extract_audio",
      "media_sheet",
      "media_video",
      "transcribe",
      "models",
      "media_status",
      "cut_plan",
      "asset_search",
      "asset_add",
      "assets",
      "page_shot",
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
    expect(readOnly).toEqual([
      "status",
      "snap",
      "sheet",
      "timeline",
      "check",
      "render_status",
      "media_info",
      "media_audio",
      "media_sheet",
      "media_video",
      "media_status",
      "asset_search",
      "assets",
    ]);
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
    expect(cli.errors).toContain("smoove agent start");
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
  it("maps media flags, with decimal seconds", () => {
    expect(argsToInput("footage_add", {}, ["~/talk.mp4"])).toEqual({ path: "~/talk.mp4" });
    expect(
      argsToInput("media_audio", { threshold: "25", "min-quiet": "0.8", peaks: "5" }, ["a.wav"]),
    ).toEqual({ source: "a.wav", thresholdDb: 25, minQuiet: 0.8, peaks: 5 });
  });

  it("maps extract_audio's preset and range", () => {
    expect(
      argsToInput("extract_audio", { preset: "transcribe", from: "1.5", to: "9" }, ["a.mp4"]),
    ).toEqual({ source: "a.mp4", preset: "transcribe", from: 1.5, to: 9 });
    expect(() => argsToInput("extract_audio", { preset: "flac" }, ["a.mp4"])).toThrow(
      "--preset must be transcribe or m4a.",
    );
  });

  it("maps media_sheet's tiles, times and exact flag", () => {
    expect(
      argsToInput("media_sheet", { tiles: "6", at: "1.5, 30,61", width: "200", exact: true }, [
        "a.mp4",
      ]),
    ).toEqual({ source: "a.mp4", tiles: 6, at: [1.5, 30, 61], width: 200, exact: true });
    expect(() => argsToInput("media_sheet", { at: "1,x" }, ["a.mp4"])).toThrow(
      "--at must be seconds separated by commas, like 1.5,30,61.",
    );
  });

  it("refuses a media range that runs backwards", () => {
    for (const name of ["media_sheet", "media_video", "extract_audio"]) {
      const parsed = commandNamed(name)?.input.safeParse({ source: "a.mp4", from: 90, to: 60 });
      expect(parsed?.success, name).toBe(false);
    }
  });

  it("maps media_video's range and rate", () => {
    expect(argsToInput("media_video", { from: "60", to: "90.5", rate: "2" }, ["a.mp4"])).toEqual({
      source: "a.mp4",
      from: 60,
      to: 90.5,
      rate: 2,
    });
  });

  it("maps transcribe's engine, language and fresh", () => {
    expect(
      argsToInput("transcribe", { engine: "api", language: "en", fresh: true }, ["a.mp4"]),
    ).toEqual({ source: "a.mp4", engine: "api", language: "en", fresh: true });
    expect(() => argsToInput("transcribe", { engine: "whisper" }, ["a.mp4"])).toThrow(
      "--engine must be auto, import, local or api.",
    );
  });

  it("maps models list and install", () => {
    expect(argsToInput("media_status", {}, ["transcribe.talk-0123456789"])).toEqual({
      job: "transcribe.talk-0123456789",
    });
    expect(argsToInput("models", {}, [])).toEqual({});
    expect(argsToInput("models", {}, ["list"])).toEqual({});
    expect(argsToInput("models", {}, ["install", "parakeet"])).toEqual({ install: "parakeet" });
    expect(() => argsToInput("models", {}, ["remove"])).toThrow(
      "models takes list, or install parakeet.",
    );
  });

  it("tells the agent to ask before installing a model", () => {
    expect(commandNamed("models")?.description).toContain("Install only after the user agrees");
  });

  it("maps cut_plan's ranges and lists", () => {
    expect(
      argsToInput(
        "cut_plan",
        {
          comp: "short",
          keep: "192.4-211, 264.2-290.6",
          fillers: "um,uh",
          "max-pause": "0.8",
          target: "60",
        },
        [],
      ),
    ).toEqual({
      composition: "short",
      keep: [
        { start: 192.4, end: 211 },
        { start: 264.2, end: 290.6 },
      ],
      fillers: ["um", "uh"],
      maxPause: 0.8,
      target: 60,
    });
    expect(() => argsToInput("cut_plan", { comp: "short", keep: "5-2" }, [])).toThrow(
      "--keep takes start-end pairs in seconds separated by commas, like 192.4-211,264.2-290.6.",
    );
  });

  it("maps new's template and source", () => {
    expect(
      argsToInput("new", { title: "Short", template: "recut", source: "footage/talk.mp4" }, []),
    ).toEqual({ title: "Short", template: "recut", source: "footage/talk.mp4" });
    expect(() => argsToInput("new", { title: "Short", template: "reel" }, [])).toThrow(
      "--template must be title or recut.",
    );
  });

  it("maps the asset commands", () => {
    expect(
      argsToInput("asset_search", { type: "audio", count: "5", "any-license": true }, [
        "rain",
        "on",
        "glass",
      ]),
    ).toEqual({
      query: "rain on glass",
      type: "audio",
      count: 5,
      anyLicense: true,
    });
    expect(
      argsToInput(
        "asset_add",
        { openverse: "image:abc", name: "Heat pump", license: "CC BY 4.0" },
        [],
      ),
    ).toEqual({ openverse: "image:abc", name: "Heat pump", license: "CC BY 4.0" });
    expect(argsToInput("asset_add", {}, ["https://x.example/a.png"])).toEqual({
      from: "https://x.example/a.png",
    });
  });

  it("tells the agent to use its own tools first for assets", () => {
    for (const name of ["asset_search", "asset_add", "page_shot"]) {
      expect(commandNamed(name)?.description, name).toMatch(/^If your own tools can/);
    }
  });

  it("maps page_shot's size and name", () => {
    expect(
      argsToInput("page_shot", { width: "1440", height: "900", name: "docs" }, [
        "https://smoove.dev",
      ]),
    ).toEqual({
      url: "https://smoove.dev",
      width: 1440,
      height: 900,
      name: "docs",
    });
  });

  it("refuses a decimal flag that isn't a number", () => {
    expect(() => argsToInput("media_audio", { "min-quiet": "soon" }, ["a.wav"])).toThrow(
      "--min-quiet must be a number of seconds.",
    );
  });

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
  it("lists every command and smoove agent mcp", async () => {
    const out: string[] = [];
    const code = await main(["--help"], {
      cwd: "/",
      out: (t) => out.push(t),
      err: () => {},
      sleep: () => Promise.resolve(),
      env: {},
    });
    expect(code).toBe(0);
    for (const c of COMMANDS) {
      expect(out[0]).toContain(c.group === "top" ? `smoove ${c.name}` : `smoove agent ${c.name}`);
    }
    expect(out[0]).toContain("smoove agent mcp");
  });
});

describe("command groups", () => {
  function capture(cwd = "/") {
    const out: string[] = [];
    const err: string[] = [];
    return {
      out,
      err,
      io: {
        cwd,
        out: (t: string) => out.push(t),
        err: (t: string) => err.push(t),
        sleep: () => Promise.resolve(),
        env: {},
      },
    };
  }

  it("keeps the MCP tool names", () => {
    expect(COMMANDS.filter((c) => c.name !== "new").map((c) => c.name)).toEqual([
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
      "footage_add",
      "media_info",
      "media_audio",
      "extract_audio",
      "media_sheet",
      "media_video",
      "transcribe",
      "models",
      "media_status",
      "cut_plan",
      "asset_search",
      "asset_add",
      "assets",
      "page_shot",
    ]);
  });

  it("puts render at the top level and the rest under agent", () => {
    expect(commandNamed("render")?.group).toBe("top");
    for (const name of [
      "status",
      "start",
      "stop",
      "seek",
      "snap",
      "sheet",
      "timeline",
      "context",
      "check",
      "render_status",
      "footage_add",
      "media_info",
      "media_audio",
      "extract_audio",
      "media_sheet",
      "media_video",
      "transcribe",
      "models",
      "media_status",
      "cut_plan",
      "asset_search",
      "asset_add",
      "assets",
      "page_shot",
    ]) {
      expect(commandNamed(name)?.group, name).toBe("agent");
    }
  });

  it("spells each command the way its front door runs it", () => {
    const cli = { door: "cli" } as RunContext;
    const mcp = { door: "mcp" } as RunContext;
    expect(spell(cli, "snap")).toBe("smoove agent snap");
    expect(spell(cli, "render")).toBe("smoove render");
    expect(spell(mcp, "snap")).toBe("the snap tool");
  });

  it("points a flat agent command at its new spelling", async () => {
    const a = capture();
    expect(await main(["snap"], a.io)).toBe(2);
    expect(a.err.join("\n")).toContain("smoove agent snap");
  });

  it("runs agent commands under smoove agent", async () => {
    const a = capture();
    // No dev server here, so status fails with the hint to start one.
    expect(await main(["agent", "status"], a.io)).toBe(1);
    expect(a.err.join("\n")).toContain("smoove agent start");
  });

  it("runs render at the top level", async () => {
    const a = capture();
    // Routed to the table's render: with no dev server it fails (1), not a usage error (2).
    expect(await main(["render", "--comp", "a", "--no-wait"], a.io)).toBe(1);
    expect(a.err.join("\n")).toContain("No smoove dev server is running");
    const b = capture();
    expect(await main(["agent", "render"], b.io)).toBe(2);
  });

  it("refuses an unknown agent command", async () => {
    const a = capture();
    expect(await main(["agent", "dance"], a.io)).toBe(2);
    expect(a.err.join("\n")).toContain('Unknown command "agent dance"');
  });

  it("lists top level, agent, then studio in the help", async () => {
    const a = capture();
    expect(await main(["--help"], a.io)).toBe(0);
    const help = a.out[0] ?? "";
    const start = help.indexOf("smoove start");
    const snap = help.indexOf("smoove agent snap");
    const detach = help.indexOf("smoove studio detach");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(snap).toBeGreaterThan(start);
    expect(detach).toBeGreaterThan(snap);
    expect(help).toContain("smoove agent mcp");
    expect(help).toContain("smoove render");
  });
});

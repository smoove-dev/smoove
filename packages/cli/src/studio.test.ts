import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Io, main } from "./main.js";
import { runStudioCommand, type StudioDeps } from "./studio.js";

let root = "";
let calls: string[] = [];
let err: string[] = [];

/** Record a call and succeed. */
async function record(call: string): Promise<number> {
  calls.push(call);
  return 0;
}

const deps: StudioDeps = {
  start: (r, port) => record(`start ${r} ${port ?? ""}`.trim()),
  serve: (r, port) => record(`serve ${r} ${port ?? ""}`.trim()),
  build: (r) => record(`build ${r}`),
  test: (r) => record(`test ${r}`),
  runScript: (r, script) => record(`script ${script} ${r}`),
};

function io(cwd = root): Io {
  return {
    cwd,
    out: () => {},
    err: (t) => err.push(t),
    sleep: () => Promise.resolve(),
    env: {},
  };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "smoove-studio-cmd-"));
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ scripts: { dev: "smoove start", build: "smoove build" } }),
  );
  calls = [];
  err = [];
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("in a preset project", () => {
  it("start runs the hidden studio", async () => {
    expect(await runStudioCommand("start", { port: 5300 }, io(), deps)).toBe(0);
    expect(calls).toEqual([`start ${root} 5300`]);
  });

  it("start --prod serves the build", async () => {
    expect(await runStudioCommand("start", { prod: true }, io(), deps)).toBe(0);
    expect(calls).toEqual([`serve ${root}`]);
  });

  it("build and test run the preset's own", async () => {
    await runStudioCommand("build", {}, io(), deps);
    await runStudioCommand("test", {}, io(), deps);
    expect(calls).toEqual([`build ${root}`, `test ${root}`]);
  });

  it("works from a subfolder of the project", async () => {
    const sub = join(root, "compositions", "intro");
    mkdirSync(sub, { recursive: true });
    await runStudioCommand("start", {}, io(sub), deps);
    expect(calls).toEqual([`start ${root}`]);
  });
});

describe("in a detached project", () => {
  beforeEach(() => writeFileSync(join(root, "react-router.config.ts"), "export default {};"));

  it("runs the project's own scripts", async () => {
    await runStudioCommand("start", {}, io(), deps);
    await runStudioCommand("start", { prod: true }, io(), deps);
    await runStudioCommand("build", {}, io(), deps);
    await runStudioCommand("test", {}, io(), deps);
    expect(calls).toEqual([
      `script dev ${root}`,
      `script start ${root}`,
      `script build ${root}`,
      `script test ${root}`,
    ]);
  });
});

describe("outside a project", () => {
  it("says there's no project", async () => {
    const empty = mkdtempSync(join(tmpdir(), "smoove-nothing-"));
    try {
      expect(await runStudioCommand("start", {}, io(empty), deps)).toBe(1);
      expect(err.join("\n")).toContain("There's no smoove project here or above.");
      expect(calls).toEqual([]);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe("smoove studio detach", () => {
  function capture(cwd = root, interactive = false) {
    const out: string[] = [];
    const errors: string[] = [];
    const value: Io = {
      cwd,
      interactive,
      out: (t) => out.push(t),
      err: (t) => errors.push(t),
      sleep: () => Promise.resolve(),
      env: {},
    };
    return { io: value, out, errors };
  }

  it("needs --yes when there's no terminal to confirm in", async () => {
    const a = capture();
    expect(await main(["studio", "detach"], a.io)).toBe(2);
    expect(a.errors.join("\n")).toContain("--yes");
    expect(existsSync(join(root, "react-router.config.ts"))).toBe(false);
  });

  it("detaches with --yes and says what it wrote", async () => {
    const a = capture();
    expect(await main(["studio", "detach", "--yes"], a.io)).toBe(0);
    expect(existsSync(join(root, "react-router.config.ts"))).toBe(true);
    expect(existsSync(join(root, "studio", "root.tsx"))).toBe(true);
    const out = a.out.join("\n");
    expect(out).toContain("vite.config.ts");
    expect(out).toContain("smoove start");
  });

  it("says when the project is already detached", async () => {
    writeFileSync(join(root, "react-router.config.ts"), "export default {};");
    const a = capture();
    expect(await main(["studio", "detach", "--yes"], a.io)).toBe(1);
    expect(a.errors.join("\n")).toContain("already detached");
  });
});

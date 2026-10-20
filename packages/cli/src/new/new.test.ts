import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { COMMANDS, commandNamed, UsageError } from "../commands.js";
import { type Io, main } from "../main.js";
import { createComposition, existingGroups } from "./new.js";

let root = "";
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "smoove-new-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { dev: "smoove start" } }));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function index(folder: string, body: string) {
  mkdirSync(join(root, "compositions", folder), { recursive: true });
  writeFileSync(join(root, "compositions", folder, "index.ts"), body);
}

describe("createComposition", () => {
  it("writes the five files, creating compositions/ when it's missing", () => {
    const { dir, files } = createComposition(root, { title: "Product launch" });
    expect(dir).toBe(join(root, "compositions", "product-launch"));
    expect(files.sort()).toEqual([
      "composition.check.ts",
      "composition.test.ts",
      "composition.ts",
      "index.ts",
      "schema.ts",
    ]);
    const entry = read("compositions/product-launch/index.ts");
    expect(entry).toContain('id: "product-launch"');
    expect(entry).toContain('title: "Product launch"');
    expect(entry).toContain('group: "Compositions"');
    expect(read("compositions/product-launch/schema.ts")).toContain('"Product launch"');
  });

  it("sizes the composition by its format, at 30 fps", () => {
    createComposition(root, { title: "Tall", format: "portrait", seconds: 8 });
    const comp = read("compositions/tall/composition.ts");
    expect(comp).toMatch(/width = 1080\b/);
    expect(comp).toMatch(/height = 1920\b/);
    expect(comp).toMatch(/fps = 30\b/);
    expect(comp).toMatch(/seconds = 8\b/);
  });

  it("defaults to landscape for 5 seconds", () => {
    createComposition(root, { title: "Wide" });
    const comp = read("compositions/wide/composition.ts");
    expect(comp).toMatch(/width = 1920\b/);
    expect(comp).toMatch(/height = 1080\b/);
    expect(comp).toMatch(/seconds = 5\b/);
  });

  it("keeps quotes in the title safe", () => {
    createComposition(root, { title: 'Say "hi"', id: "say-hi", description: "It's here" });
    expect(read("compositions/say-hi/index.ts")).toContain('title: "Say \\"hi\\""');
  });

  it("refuses a folder that's already there", () => {
    index("intro", 'export default { id: "intro" };');
    expect(() => createComposition(root, { title: "Intro" })).toThrow(UsageError);
  });

  it("refuses an id that only differs by case from a folder", () => {
    mkdirSync(join(root, "compositions", "Intro"), { recursive: true });
    expect(() => createComposition(root, { title: "x", id: "intro" })).toThrow(/Intro/);
  });

  it("refuses an id another composition declares", () => {
    index("opening", 'export default { id: "intro", title: "Intro" };');
    expect(() => createComposition(root, { title: "Intro" })).toThrow(/compositions\/opening/);
    expect(existsSync(join(root, "compositions", "intro"))).toBe(false);
  });
});

describe("existingGroups", () => {
  it("lists each group once, in order", () => {
    index("a", 'export default { id: "a", group: "Ads" };');
    index("b", "export default { id: 'b', group: 'Basics' };");
    index("c", 'export default { id: "c", group: "Ads" };');
    expect(existingGroups(root)).toEqual(["Ads", "Basics"]);
  });
});

describe("the new command", () => {
  it("is in the table, at the top level", () => {
    expect(commandNamed("new")?.group).toBe("top");
    expect(COMMANDS.map((c) => c.name)).toContain("new");
  });

  it("refuses an id that isn't kebab case", () => {
    const input = commandNamed("new")?.input;
    expect(input?.safeParse({ title: "x", id: "Not Kebab" }).success).toBe(false);
    expect(input?.safeParse({ title: "x", id: "kebab-case-2" }).success).toBe(true);
  });

  it("lists the flags when there's no terminal to ask for a title", async () => {
    const err: string[] = [];
    const io: Io = {
      cwd: root,
      out: () => {},
      err: (t) => err.push(t),
      sleep: () => Promise.resolve(),
      env: {},
    };
    expect(await main(["new"], io)).toBe(2);
    expect(err.join("\n")).toContain("--title");
  });

  it("creates the folder from flags and names it", async () => {
    const out: string[] = [];
    const io: Io = {
      cwd: root,
      out: (t) => out.push(t),
      err: () => {},
      sleep: () => Promise.resolve(),
      env: {},
    };
    expect(await main(["new", "--title", "Launch teaser", "--format", "square"], io)).toBe(0);
    expect(existsSync(join(root, "compositions/launch-teaser/index.ts"))).toBe(true);
    expect(out.join("\n")).toContain("compositions/launch-teaser");
  });
});

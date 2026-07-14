import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ProjectFs } from "../src/server/project/project-fs.js";
import { cleanupProject, makeTempProject } from "./helpers.js";

let root: string;
let project: ProjectFs;

beforeEach(async () => {
  project = await makeTempProject();
  root = project.root;
});

afterEach(async () => {
  await cleanupProject(project);
});

describe("init", () => {
  it("creates the root and writes a tsconfig", async () => {
    const tsconfig = await readFile(path.join(root, "tsconfig.json"), "utf8");
    expect(JSON.parse(tsconfig).compilerOptions.moduleResolution).toBe("bundler");
  });

  it("is idempotent and does not clobber an existing tsconfig", async () => {
    await writeFile(path.join(root, "tsconfig.json"), '{"custom":true}\n');
    await project.init();
    const tsconfig = await readFile(path.join(root, "tsconfig.json"), "utf8");
    expect(JSON.parse(tsconfig)).toEqual({ custom: true });
  });
});

describe("path jail", () => {
  // An LLM will eventually emit `../../../etc/passwd` — through confusion, or
  // through an injection in a file it just read. This is the wall.
  it.each(["../escape.ts", "a/../../escape.ts", "/etc/passwd", ""])("refuses %j", async (bad) => {
    await expect(project.read(bad)).rejects.toThrow(/outside the project/i);
  });

  it("allows a nested path inside the root", async () => {
    await project.write("nested/deep/file.ts", "export const x = 1;\n");
    expect(await project.read("nested/deep/file.ts")).toBe("export const x = 1;\n");
  });
});

describe("write / read", () => {
  it("round-trips, creating parent directories", async () => {
    await project.write("a/b/c.ts", "hello");
    expect(await project.read("a/b/c.ts")).toBe("hello");
  });

  it("throws a useful error for a missing file", async () => {
    await expect(project.read("nope.ts")).rejects.toThrow(/nope\.ts/);
  });
});

describe("edit", () => {
  beforeEach(async () => {
    await project.write("f.ts", "const a = 1;\nconst b = 2;\n");
  });

  it("replaces a unique match", async () => {
    await project.edit("f.ts", "const b = 2;", "const b = 3;");
    expect(await project.read("f.ts")).toBe("const a = 1;\nconst b = 3;\n");
  });

  it("refuses when the string is not found", async () => {
    await expect(project.edit("f.ts", "const z = 9;", "x")).rejects.toThrow(/not found/i);
  });

  it("refuses an ambiguous match rather than guessing", async () => {
    await project.write("dup.ts", "x\nx\n");
    await expect(project.edit("dup.ts", "x", "y")).rejects.toThrow(/2 matches/i);
  });
});

describe("scaffold + list", () => {
  const spec = {
    id: "good-job",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 900,
    title: "Good Job",
  };

  it("writes meta.json and a composition, and lists it", async () => {
    const result = await project.scaffold(spec);
    expect(result).toEqual({
      id: "good-job",
      metaPath: "good-job/meta.json",
      compositionPath: "good-job/composition.ts",
    });

    const code = await project.read("good-job/composition.ts");
    expect(code).toContain("const width = 1080;");
    expect(code).toContain('new Composition({\n  id: "good-job",');

    const list = await project.list();
    expect(list).toEqual([
      {
        id: "good-job",
        title: "Good Job",
        width: 1080,
        height: 1920,
        fps: 30,
        durationInFrames: 900,
      },
    ]);
  });

  it("refuses to overwrite an existing composition", async () => {
    await project.scaffold(spec);
    await expect(project.scaffold(spec)).rejects.toThrow(/already exists/i);
  });

  it("refuses an id that is not a safe directory name", async () => {
    await expect(project.scaffold({ ...spec, id: "../evil" })).rejects.toThrow(/invalid id/i);
    await expect(project.scaffold({ ...spec, id: "Good Job" })).rejects.toThrow(/invalid id/i);
  });

  it("returns an empty list for a fresh project", async () => {
    expect(await project.list()).toEqual([]);
  });

  it("ignores non-composition directories and files", async () => {
    await project.write("notes.md", "scratch");
    await project.write("half-baked/composition.ts", "// no meta.json");
    expect(await project.list()).toEqual([]);
  });

  it("surfaces a malformed meta.json instead of silently skipping it", async () => {
    await project.write("broken/meta.json", "{ not json");
    await expect(project.list()).rejects.toThrow(/broken\/meta\.json/);
  });

  it("sorts by id so the catalog is deterministic", async () => {
    await project.scaffold({ ...spec, id: "zebra" });
    await project.scaffold({ ...spec, id: "alpha" });
    expect((await project.list()).map((m) => m.id)).toEqual(["alpha", "zebra"]);
  });
});

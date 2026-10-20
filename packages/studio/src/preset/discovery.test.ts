import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverCompositions, registryModuleCode } from "./discovery.js";

let root = "";
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "smoove-discovery-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function file(path: string, body = "export default {};") {
  const full = join(root, path);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, body);
}

describe("discoverCompositions", () => {
  it("finds folders with an index file and reports the ones without", () => {
    file("compositions/b/index.ts");
    file("compositions/a/index.js");
    file("compositions/c/README.md", "# notes");
    file("compositions/.hidden/index.ts");
    file("compositions/notes.txt", "hi");
    const found = discoverCompositions(join(root, "compositions"));
    expect(found.folders).toEqual([
      { name: "a", index: join(root, "compositions/a/index.js") },
      { name: "b", index: join(root, "compositions/b/index.ts") },
    ]);
    expect(found.missing).toEqual(["c"]);
  });

  it("prefers index.ts over index.js", () => {
    file("compositions/a/index.ts");
    file("compositions/a/index.js");
    expect(discoverCompositions(join(root, "compositions")).folders[0]?.index).toBe(
      join(root, "compositions/a/index.ts"),
    );
  });

  it("treats a missing compositions folder as empty", () => {
    expect(discoverCompositions(join(root, "compositions"))).toEqual({ folders: [], missing: [] });
  });
});

describe("registryModuleCode", () => {
  it("imports each index by its absolute path, spaces and all", () => {
    const dir = join(root, "my project", "compositions");
    const code = registryModuleCode({
      folders: [
        { name: "a", index: join(dir, "a/index.ts") },
        { name: "b", index: join(dir, "b/index.js") },
      ],
      missing: ["c"],
    });
    const specifiers = [...code.matchAll(/^import \w+ from (".*");$/gm)].map((m) =>
      JSON.parse(m[1] ?? '""'),
    );
    expect(specifiers).toEqual([join(dir, "a/index.ts"), join(dir, "b/index.js")]);
    expect(code).toContain('import { defineRegistry } from "@smoove/studio";');
    expect(code).toContain("defineRegistry([c0, c1], {");
    expect(code).toContain('"missing":["c"]');
    expect(code).toContain('"folders":["a","b"]');
  });
});

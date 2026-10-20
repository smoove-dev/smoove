import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PRESET_DIR, PresetError, syncPresetApp } from "./app.js";
import { detach, planDetach } from "./detach.js";

let root = "";
const PKG = {
  name: "my-video",
  scripts: {
    dev: "smoove start",
    build: "smoove build",
    start: "smoove start --prod",
    test: "smoove test",
    typecheck: "tsc",
    lint: "biome check .",
  },
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "smoove-detach-"));
  writeFileSync(join(root, "package.json"), `${JSON.stringify(PKG, null, 2)}\n`);
  writeFileSync(join(root, "smoove.config.ts"), "export default {};\n");
  mkdirSync(join(root, "compositions/intro"), { recursive: true });
  writeFileSync(join(root, "compositions/intro/index.ts"), 'export default { id: "intro" };\n');
  writeFileSync(join(root, "tsconfig.json"), '{ "extends": "@smoove/studio/tsconfig.json" }\n');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("detach", () => {
  it("writes the app and the configs, and points the scripts at them", () => {
    detach(root);
    for (const file of [
      "studio/root.tsx",
      "studio/routes/home.tsx",
      "vite.config.ts",
      "react-router.config.ts",
      "vitest.config.ts",
    ]) {
      expect(existsSync(join(root, file)), file).toBe(true);
    }
    expect(readFileSync(join(root, "tsconfig.json"), "utf8")).toContain('"studio"');
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(pkg.scripts).toEqual({
      dev: "react-router dev",
      build: "react-router build",
      start: "react-router-serve ./build/server/index.js",
      test: "vitest run",
      typecheck: "react-router typegen && tsc",
      lint: "biome check .",
    });
  });

  it("leaves the compositions and smoove.config.ts byte for byte", () => {
    detach(root);
    expect(readFileSync(join(root, "compositions/intro/index.ts"), "utf8")).toBe(
      'export default { id: "intro" };\n',
    );
    expect(readFileSync(join(root, "smoove.config.ts"), "utf8")).toBe("export default {};\n");
  });

  it("removes the hidden app", () => {
    syncPresetApp(root);
    detach(root);
    expect(existsSync(join(root, PRESET_DIR))).toBe(false);
  });

  it("refuses a project that's already detached", () => {
    detach(root);
    expect(() => detach(root)).toThrow(PresetError);
    expect(() => detach(root)).toThrow(/already detached/);
  });

  it("refuses to write over a studio/ folder that's already there", () => {
    mkdirSync(join(root, "studio"));
    expect(() => detach(root)).toThrow(/studio\//);
    expect(existsSync(join(root, "vite.config.ts"))).toBe(false);
  });
});

describe("planDetach", () => {
  it("lists every file detach writes", () => {
    const plan = planDetach(root);
    detach(root);
    for (const file of plan.write) expect(existsSync(join(root, file)), file).toBe(true);
    expect(plan.write).toContain("vite.config.ts");
    expect(plan.write).toContain("tsconfig.json");
    expect(plan.write.some((f) => f.startsWith("studio/"))).toBe(true);
    expect(plan.scripts.dev).toBe("react-router dev");
  });
});

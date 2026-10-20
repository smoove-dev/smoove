import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isDetached, PRESET_DIR, PresetError, syncPresetApp } from "./app.js";
import { servePreset } from "./run.js";

let root = "";
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "smoove preset "));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("syncPresetApp", () => {
  it("writes the app and both configs on the first sync", () => {
    const { dir, written } = syncPresetApp(root);
    expect(dir).toBe(join(root, PRESET_DIR));
    for (const file of [
      "app/root.tsx",
      "app/routes/home.tsx",
      "vite.config.ts",
      "react-router.config.ts",
    ]) {
      expect(existsSync(join(dir, file)), file).toBe(true);
      expect(written).toContain(file);
    }
  });

  it("writes nothing the second time when nothing changed", () => {
    syncPresetApp(root);
    expect(syncPresetApp(root)).toMatchObject({ written: [], removed: [] });
  });

  it("removes files the template no longer has", () => {
    syncPresetApp(root);
    const stale = join(root, PRESET_DIR, "app/routes/old-route.tsx");
    writeFileSync(stale, "export default null;");
    const { removed } = syncPresetApp(root);
    expect(existsSync(stale)).toBe(false);
    expect(removed).toEqual(["app/routes/old-route.tsx"]);
  });

  it("puts a template file back when it was changed by hand", () => {
    syncPresetApp(root);
    const home = join(root, PRESET_DIR, "app/routes/home.tsx");
    writeFileSync(home, "edited");
    expect(syncPresetApp(root).written).toEqual(["app/routes/home.tsx"]);
    expect(readFileSync(home, "utf8")).not.toBe("edited");
  });

  it("points the generated configs at the project", () => {
    const { dir } = syncPresetApp(root);
    expect(readFileSync(join(dir, "vite.config.ts"), "utf8")).toContain(
      `smooveStudio({ root: ${JSON.stringify(root)} })`,
    );
    const rr = readFileSync(join(dir, "react-router.config.ts"), "utf8");
    expect(rr).toContain('appDirectory: "app"');
    expect(rr).toContain(`buildDirectory: ${JSON.stringify(join(root, "build"))}`);
  });
});

describe("isDetached", () => {
  it("sees a react-router.config.ts at the project root", () => {
    expect(isDetached(root)).toBe(false);
    writeFileSync(join(root, "react-router.config.ts"), "export default {};");
    expect(isDetached(root)).toBe(true);
  });
});

describe("servePreset", () => {
  it("says to run smoove build when there's no build", () => {
    mkdirSync(join(root, "build"));
    expect(() => servePreset({ root })).toThrow(PresetError);
    expect(() => servePreset({ root })).toThrow(/smoove build/);
  });
});

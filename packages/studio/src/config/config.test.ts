import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveStudioConfig, StudioConfigError } from "./config.js";

let dir = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "smoove-config-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function message(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(StudioConfigError);
    return (err as Error).message;
  }
  throw new Error("expected a StudioConfigError");
}

describe("resolveStudioConfig", () => {
  it("resolves an empty config to the defaults", () => {
    expect(resolveStudioConfig({}, dir)).toEqual({
      name: null,
      logo: null,
      primaryColor: null,
      render: true,
    });
  });

  it("keeps the name, color and render switch", () => {
    expect(
      resolveStudioConfig({ name: "Acme", primaryColor: "#15cda8", render: false }, dir),
    ).toEqual({ name: "Acme", logo: null, primaryColor: "#15cda8", render: false });
  });

  it("resolves the logo relative to the config folder", () => {
    mkdirSync(join(dir, "brand"));
    writeFileSync(join(dir, "brand", "logo.svg"), "<svg/>");
    expect(resolveStudioConfig({ logo: "./brand/logo.svg" }, dir).logo).toBe(
      join(dir, "brand", "logo.svg"),
    );
  });

  it("names the path when the logo file is missing", () => {
    const m = message(() => resolveStudioConfig({ logo: "./nope.svg" }, dir));
    expect(m).toContain("logo");
    expect(m).toContain("./nope.svg");
  });

  it("refuses a logo that isn't an image", () => {
    writeFileSync(join(dir, "logo.txt"), "hi");
    expect(message(() => resolveStudioConfig({ logo: "./logo.txt" }, dir))).toContain("logo");
  });

  it("names an unknown key and lists the valid ones", () => {
    const m = message(() => resolveStudioConfig({ colour: "red" }, dir));
    expect(m).toContain("colour");
    for (const key of ["name", "logo", "primaryColor", "render"]) expect(m).toContain(key);
  });

  it("names the key with the wrong type", () => {
    expect(message(() => resolveStudioConfig({ render: "no" }, dir))).toContain("render");
    expect(message(() => resolveStudioConfig({ name: "" }, dir))).toContain("name");
    expect(message(() => resolveStudioConfig({ primaryColor: 3 }, dir))).toContain("primaryColor");
  });

  it("refuses a config that isn't an object", () => {
    message(() => resolveStudioConfig(null, dir));
    message(() => resolveStudioConfig([], dir));
  });
});

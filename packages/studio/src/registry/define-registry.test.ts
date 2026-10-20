import { afterEach, describe, expect, it, vi } from "vitest";
import type { RegistryEntry } from "../types.js";
import { defineRegistry } from "./define-registry.js";

const entry = (id: string): RegistryEntry => ({ id, title: id, composition: () => null as never });

afterEach(() => vi.restoreAllMocks());

describe("defineRegistry with folders", () => {
  it("skips a duplicate id and names both folders", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const registry = defineRegistry([entry("intro"), entry("intro")], {
      folders: ["intro", "intro-copy"],
    });
    expect(registry.entries().map((e) => e.id)).toEqual(["intro"]);
    const [problem] = registry.problems();
    expect(problem?.level).toBe("error");
    expect(problem?.message).toContain("compositions/intro");
    expect(problem?.message).toContain("compositions/intro-copy");
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("warns when an id differs from its folder name", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const registry = defineRegistry([entry("outro")], { folders: ["ending"] });
    expect(registry.entries()).toHaveLength(1);
    expect(registry.problems()).toEqual([
      { level: "warning", message: expect.stringContaining("compositions/ending") },
    ]);
    expect(registry.problems()[0]?.message).toContain("outro");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("reports folders with no index file", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const registry = defineRegistry([], { folders: [], missing: ["broken"] });
    expect(registry.problems()).toEqual([
      { level: "error", message: expect.stringContaining("compositions/broken") },
    ]);
    expect(registry.problems()[0]?.message).toContain("index.ts");
  });

  it("has no problems when every folder matches", () => {
    expect(defineRegistry([entry("a")], { folders: ["a"] }).problems()).toEqual([]);
  });
});

describe("defineRegistry without folders", () => {
  it("still throws on a duplicate id", () => {
    expect(() => defineRegistry([entry("a"), entry("a")])).toThrow(/duplicate id "a"/);
  });
});

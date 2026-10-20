import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lintProject, lintSource } from "./lint.js";

const HEAD = `import { random, Sequence } from "@smoove/core";\nimport Konva from "konva";\n`;
const codes = (src: string) => lintSource(HEAD + src, "src/promo.ts").map((f) => f.code);

describe("lintSource", () => {
  it("finds Math.random at module scope and in an updater, with 1-based positions", () => {
    const found = lintSource(
      `${HEAD}const seed = Math.random();\nseq.register((f) => {\n  dot.x(Math.random());\n});\n`,
      "src/promo.ts",
    );
    expect(found.map((f) => f.code)).toEqual(["purity/math-random", "purity/math-random"]);
    expect(found[0]?.source).toEqual({
      file: "src/promo.ts",
      line: 3,
      column: 14,
      inherited: false,
    });
    expect(found[1]?.source.line).toBe(5);
  });

  it("finds clock reads and timers", () => {
    for (const call of [
      "Date.now()",
      "new Date()",
      "performance.now()",
      "requestAnimationFrame(tick)",
      "setTimeout(tick, 10)",
      "setInterval(tick, 10)",
      "new Konva.Tween({})",
      "new Konva.Animation(tick)",
    ]) {
      expect(codes(`${call};\n`), call).toEqual(["purity/clock"]);
    }
  });

  it("leaves a dated constructor alone", () => {
    expect(codes("new Date(2020, 1, 1);\n")).toEqual([]);
  });

  it("finds a module-level generator advanced inside an updater", () => {
    expect(codes(`const r = random("x");\nseq.register((f) => dot.x(r.range(0, 1)));\n`)).toEqual([
      "purity/random-in-updater",
    ]);
    expect(codes(`const r = random("x");\nseq.register(() => dot.x(r()));\n`)).toEqual([
      "purity/random-in-updater",
    ]);
  });

  it("allows a generator made inside the updater, and one read at module scope", () => {
    expect(codes(`seq.register((f) => { const r = random("x"); dot.x(r()); });\n`)).toEqual([]);
    expect(codes(`const r = random("x");\nconst xs = [r.range(0, 1), r.int(0, 9)];\n`)).toEqual([]);
  });

  it("reads TypeScript and JSX", () => {
    const src = `import type { Text } from "@smoove/core";
const m = new Map<string, Text>();
const cfg = { a: 1 } satisfies Record<string, number>;
const el = <div>{cfg.a}</div>;
`;
    expect(lintSource(HEAD + src, "src/promo.tsx")).toEqual([]);
    expect(lintSource(`${HEAD}const n = <number>(1 as unknown);\n`, "src/promo.ts")).toEqual([]);
  });

  it("reports a file that doesn't parse, once", () => {
    expect(codes("const = ;\n")).toEqual(["lint/parse-error"]);
  });
});

describe("lintProject", () => {
  it("scans project files that import smoove or konva, and skips the rest", () => {
    const root = mkdtempSync(join(tmpdir(), "smoove-lint-"));
    const bad = `${HEAD}Math.random();\n`;
    const files: Record<string, string> = {
      "src/a.ts": bad,
      "src/b.ts": "Math.random();\n", // imports neither smoove nor konva
      "src/a.test.ts": bad,
      "src/a.spec.ts": bad,
      "src/a.check.ts": bad,
      "node_modules/x/index.ts": bad,
      ".smoove/x.ts": bad,
      "dist/x.ts": bad,
      "out/x.ts": bad,
    };
    for (const [path, body] of Object.entries(files)) {
      mkdirSync(join(root, path, ".."), { recursive: true });
      writeFileSync(join(root, path), body);
    }
    const found = lintProject(root);
    expect(found.map((f) => f.source.file)).toEqual(["src/a.ts"]);
  });
});

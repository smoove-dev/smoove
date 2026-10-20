import { parse } from "@babel/parser";
import { describe, expect, it } from "vitest";
import { SOURCE_MODULE, SOURCE_MODULE_CODE, tagSources } from "./source-tags.js";

const root = "/proj";
const file = "/proj/src/comp.ts";

/** Every `__smooveSrc(..., "<file>", line, column)` tag in `code`. */
function tags(code: string): string[] {
  return [...code.matchAll(/, "([^"]+)", (\d+), (\d+)\)/g)].map((m) => `${m[1]}:${m[2]}:${m[3]}`);
}

describe("tagSources", () => {
  it("wraps a smoove node's new expression with its original line and column", () => {
    const code = [
      'import { Text } from "@smoove/core";',
      "",
      "export const title = new Text({ text: 'hi' });",
    ].join("\n");
    const out = tagSources(code, file, root);
    expect(out?.code).toContain(`import { __smooveSrc } from "${SOURCE_MODULE}";`);
    expect(out?.code).toContain(
      "export const title = __smooveSrc(new Text({ text: 'hi' }), \"src/comp.ts\", 3, 22);",
    );
  });

  it("wraps a namespace Konva class", () => {
    const code = 'import Konva from "konva";\nconst r = new Konva.Rect({ width: 4 });';
    expect(tags(tagSources(code, file, root)?.code ?? "")).toEqual(["src/comp.ts:2:11"]);
  });

  it("wraps nested new expressions, and the output still parses", () => {
    const code =
      'import { Flex, Text } from "@smoove/core";\nconst f = new Flex({ children: [new Text({})] });';
    const out = tagSources(code, file, root)?.code ?? "";
    expect(tags(out).sort()).toEqual(["src/comp.ts:2:11", "src/comp.ts:2:33"]);
    expect(() => parse(out, { sourceType: "module" })).not.toThrow();
  });

  it("keeps original positions through generics, satisfies and type-only imports", () => {
    const code = [
      'import type { Composition } from "@smoove/core";',
      'import { Text } from "@smoove/core";',
      "const cfg = { a: 1 } satisfies Record<string, number>;",
      "const byName = new Map<string, Text>();",
      "  const t = new Text({});",
    ].join("\n");
    expect(tags(tagSources(code, file, root)?.code ?? "")).toEqual([
      "src/comp.ts:4:16",
      "src/comp.ts:5:13",
    ]);
  });

  it("tags a .tsx file with JSX in it", () => {
    const code =
      'import { Text } from "@smoove/core";\nconst el = <div />;\nconst t = new Text({});';
    expect(tags(tagSources(code, "/proj/src/comp.tsx", root)?.code ?? "")).toEqual([
      "src/comp.tsx:3:11",
    ]);
  });

  it("leaves a file alone that imports neither smoove nor Konva", () => {
    expect(tagSources('import x from "y";\nconst m = new Map();', file, root)).toBeNull();
  });

  it("leaves node_modules alone", () => {
    const code = 'import { Text } from "@smoove/core";\nnew Text({});';
    expect(tagSources(code, "/proj/node_modules/@smoove/code/dist/code.js", root)).toBeNull();
  });

  it("leaves files outside the project root alone (linked workspace packages)", () => {
    const code = 'import Konva from "konva";\nnew Konva.Text({});';
    expect(tagSources(code, "/packages/core/dist/layout/text/text.js", root)).toBeNull();
  });

  it("leaves a file that doesn't parse alone", () => {
    expect(tagSources('import { Text } from "@smoove/core";\nnew Text({', file, root)).toBeNull();
  });

  it("strips a query string from the id", () => {
    const code = 'import { Text } from "@smoove/core";\nnew Text({});';
    expect(tags(tagSources(code, `${file}?t=123`, root)?.code ?? "")).toEqual(["src/comp.ts:2:1"]);
  });
});

describe("the source module", () => {
  it("tags Konva nodes only and returns what it was given", async () => {
    const mod = (await import(
      `data:text/javascript,${encodeURIComponent(SOURCE_MODULE_CODE)}`
    )) as { __smooveSrc: <T>(v: T, file: string, line: number, column: number) => T };
    const node = { getClassName: () => "Rect" } as {
      getClassName(): string;
      _smooveSource?: unknown;
    };
    expect(mod.__smooveSrc(node, "src/a.ts", 3, 7)).toBe(node);
    expect(node._smooveSource).toEqual({ file: "src/a.ts", line: 3, column: 7 });
    const map = new Map();
    expect(mod.__smooveSrc(map, "src/a.ts", 1, 1)).toBe(map);
    expect((map as unknown as { _smooveSource?: unknown })._smooveSource).toBeUndefined();
  });
});

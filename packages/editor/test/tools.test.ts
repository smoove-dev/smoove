import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listCompositions } from "../src/server/tools/compositions.js";
import type { EditorToolContext } from "../src/server/tools/context.js";
import { editFile, readFile, writeFile } from "../src/server/tools/files.js";
import { scaffoldComposition } from "../src/server/tools/scaffold.js";
import { typecheck } from "../src/server/tools/typecheck.js";
import { cleanupProject, makeTempProject } from "./helpers.js";

let ctx: EditorToolContext;

const SPEC = {
  id: "good-job",
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 900,
  title: "Good Job",
};

beforeEach(async () => {
  ctx = { project: await makeTempProject() };
});

afterEach(async () => {
  await cleanupProject(ctx.project);
});

describe("the write tools are plain functions", () => {
  it("scaffolds, lists, reads, writes and edits without an LLM", async () => {
    const scaffolded = await scaffoldComposition(ctx, SPEC);
    expect(scaffolded.compositionPath).toBe("good-job/composition.ts");

    expect(await listCompositions(ctx)).toHaveLength(1);

    const code = await readFile(ctx, { path: scaffolded.compositionPath });
    expect(code).toContain("const durationInFrames = 900;");

    await editFile(ctx, {
      path: scaffolded.compositionPath,
      oldString: '"#000000"',
      newString: '"#101014"',
    });
    expect(await readFile(ctx, { path: scaffolded.compositionPath })).toContain('"#101014"');

    const written = await writeFile(ctx, { path: "notes.md", content: "hi" });
    expect(written).toEqual({ path: "notes.md", bytes: 2 });
  });
});

describe("typecheck", () => {
  it("passes on a freshly scaffolded composition", async () => {
    await scaffoldComposition(ctx, SPEC);
    const result = await typecheck(ctx);
    expect(result).toEqual({ ok: true, diagnostics: [] });
  });

  it("reports real TYPE errors, not just syntax errors", async () => {
    await scaffoldComposition(ctx, SPEC);
    // Valid syntax; wrong type. An esbuild transform would happily accept this.
    await editFile(ctx, {
      path: "good-job/composition.ts",
      oldString: "const width = 1080;",
      newString: 'const width = "wide";',
    });

    const result = await typecheck(ctx);
    expect(result.ok).toBe(false);

    // A module-resolution failure (TS2307) would satisfy a loose "some
    // diagnostic was reported" assertion while proving nothing about type
    // checking — and that is exactly the bug this fixture used to have. Demand
    // the real assignability error, and demand that @smoove/core resolved.
    expect(result.diagnostics.map((d) => d.code)).not.toContain("TS2307");

    const typeError = result.diagnostics.find((d) => d.code === "TS2322");
    expect(typeError).toBeDefined();
    expect(typeError?.file).toBe("good-job/composition.ts");
    expect(typeError?.line).toBeGreaterThan(0);
    expect(typeError?.message).toMatch(/not assignable/i);
  });
});

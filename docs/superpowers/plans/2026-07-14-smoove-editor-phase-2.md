# SmooveEditor Phase 2 (Authoring) — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.
> **Repo overrides (AGENTS.md wins over any skill):** **NEVER COMMIT** — this plan has **no commit steps**; leave everything in the working tree. **NO SUBAGENTS** — execute inline in the main session. The changeset is **written by hand**, not via `pnpm changeset` (which is interactive).

**Goal:** Make `@smoove/editor` **author** compositions instead of only inspecting them — a filesystem-backed `ProjectFs`, five write tools, the smoove-video skill in the system prompt, and an editor composition list that is finally separate from the studio's demo registry.

**Architecture:** A **project** is a gitignored directory on disk (`packages/kitchen-sink/editor-project/`) where each composition is a folder of `meta.json` (declarative catalog row) + `composition.ts` (the animation code). Two consumers read that one directory by different mechanisms: the **agent** reads it through `ProjectFs` (live disk, re-read per call, so a comp scaffolded mid-turn is visible to the next tool call in the same turn), and the **browser** reads it through a Vite `import.meta.glob` registry (only Vite can transpile a `.ts` the browser must `import()`). Consequently `registry` is removed from `setupAi()` and `EditorToolContext` and replaced by `project: ProjectFs`.

**Tech Stack:** `ai@^7` (`tool()`, `ToolSet`), `zod@^4`, TypeScript 6.0.3 (`tsc --noEmit --pretty false` as the agent's self-correction signal), Node `fs/promises` + `child_process`, **Vitest** (new to the repo), Vite `import.meta.glob`, React Router 7.

**Spec:** `docs/superpowers/specs/2026-07-14-smoove-editor-phase-2-design.md`

---

## Verified facts (probed against the real toolchain — do not "correct" these)

- **`tsc` resolves `@smoove/core` from the scratch project dir.** A standalone `packages/kitchen-sink/editor-project/tsconfig.json` with `moduleResolution: "bundler"` and `"types": []` typechecks `*/composition.ts` **clean, exit 0**. Node resolution walks up from `editor-project/<id>/` into `packages/kitchen-sink/node_modules`, where `@smoove/core` is symlinked. No `paths` mapping is needed. (`"types": []` matters — without it tsc pulls ambient `@types/*` and the run gets slower and noisier.)
- **`tsc --pretty false` emits exactly one parseable line per diagnostic**, and **exits 2** when there are errors:
  ```
  path/to/composition.ts(5,33): error TS2322: Type '"wide"' is not assignable to type 'SizeValue | undefined'.
  path/to/composition.ts(7,6): error TS2339: Property 'nope' does not exist on type 'Composition<Record<string, unknown>>'.
  ```
  Regex: `/^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.*)$/`. Real type errors (a string where `SizeValue` is expected; a nonexistent method) are caught — this is the signal an esbuild transform could not give.
- **`execFile` rejects on a nonzero exit**, so the tsc call must be wrapped in `try/catch` and the diagnostics read off the **rejected error's `stdout`**, not just the success path.
- **The repo has no Vitest anywhere yet.** Phase 2 introduces it, in `@smoove/editor` only. TypeScript at the root is **6.0.3**.
- **`@smoove/vite`'s registry transform will NOT touch `editor-registry.ts`.** Its `include` regex (`/registry\.(?:t|j)sx?$/`) does match the filename, but `registryArray()` only acts when the default export is `defineRegistry([...])` with a literal **`ArrayExpression`** argument. Ours is `defineRegistry(toEntries())` — a `CallExpression` — so the plugin bails and returns `null`. Safe, but do not "simplify" it to a literal array or the plugin will start rewriting HMR against identifiers that don't exist.
- **The studio store tolerates an empty registry**: `store.ts` does `opts.initialId ?? entries[0]?.id ?? ""`. A blank `selectedId` loads nothing and does not throw — but it renders a silently blank stage, so the editor route needs an explicit empty state.
- **`StudioProps.render` is optional.** Omitting it on the editor route is how "server render of project comps is out of scope" degrades gracefully.
- **Phase 1 gotchas that still bind:** `getDefaultSmooveEditorTools` **must** be annotated `: ToolSet` or tsc emits TS2883 (unnameable `@ai-sdk` internals leak into the `.d.ts`). `convertToModelMessages` is **async** — keep the `await`. All relative imports need an explicit `.js` extension. Biome's `organizeImports` is an assist: use `pnpm exec biome check --write <file>`.
- **kitchen-sink dev server runs on port 5190** (its `launch.json`), not the 5174 the Phase 1 plan assumed.

---

## File structure

**`packages/editor` — new files**

| File | Responsibility |
| --- | --- |
| `src/server/project/types.ts` | `CompositionMeta`, `ScaffoldSpec`, `ScaffoldResult`, `TypecheckDiagnostic`, `TypecheckResult`. No Node, no React. |
| `src/server/project/templates.ts` | The project `tsconfig.json` and the minimal `composition.ts` stub, as strings. |
| `src/server/project/project-fs.ts` | `ProjectFs` — the path-jailed, filesystem-backed project. |
| `src/server/tools/files.ts` | `readFile`, `writeFile`, `editFile` (plain functions). |
| `src/server/tools/scaffold.ts` | `scaffoldComposition` (plain function). |
| `src/server/tools/typecheck.ts` | `typecheck` (plain function). |
| `src/server/system-prompt.ts` | `smooveVideoSystemPrompt` — the distilled skill, bundled. |
| `vitest.config.ts` | Node environment, `test/**/*.test.ts`. |
| `test/project-fs.test.ts` | list / read / write / edit / **path-jail** / scaffold. |
| `test/tools.test.ts` | The write tools + `typecheck` against clean and broken fixtures. |

**`packages/editor` — modified**

| File | Change |
| --- | --- |
| `src/server/tools/context.ts` | `EditorToolContext`: drop `registry`, add `project: ProjectFs`. |
| `src/server/tools/compositions.ts` | `listCompositions` reads `ProjectFs.list()`, not a registry. Returns `CompositionMeta[]`. |
| `src/server/tools/index.ts` | Register the five new tools. Keep the `: ToolSet` annotation. |
| `src/server/ai.ts` | `SetupAiOptions.registry` → `project`. Default system prompt becomes the skill. |
| `src/server/index.ts` | Export `ProjectFs`, the project types, and every new plain tool function. |
| `package.json` | `vitest` + `typescript` devDeps; `test` script. |

**`packages/kitchen-sink` — modified**

| File | Change |
| --- | --- |
| `src/editor-registry.ts` (new) | The editor's OWN registry, from `import.meta.glob` over `editor-project/`. |
| `editor-project/.gitkeep` (new) | Keeps the gitignored scratch dir present on a fresh clone, so Vite's glob + watcher have something to watch. |
| `src/server/ai.server.ts` | Build a `ProjectFs`; pass `project` to `setupAi` instead of `registry`. |
| `src/layouts/editor-layout.tsx` | Use `editorRegistry`; drop the `render` backend. |
| `src/routes/editor.tsx` | Use `editorRegistry`; add the empty state. |

**Root — modified:** `.gitignore` (ignore the project's contents), `package.json` (a `test` script).

---

# Part A — `ProjectFs`

## Task A1: The project contract

**Files:** Create `packages/editor/src/server/project/types.ts`

- [ ] **Step 1: Write it**

```ts
/** @smoove/editor — the on-disk project contract. No Node, no React. */

/**
 * A composition's catalog row — literally the contents of its `meta.json`.
 *
 * The project stores this as JSON rather than an executable `index.ts` (the
 * convention the demo registry uses) so that *listing* a composition never
 * requires *executing* TypeScript: `ProjectFs.list()` is a plain JSON read, and
 * the browser can glob these eagerly while lazy-importing the code.
 */
export type CompositionMeta = {
  /** Stable key. Also the directory name. */
  id: string;
  title?: string;
  group?: string;
  description?: string;
  tags?: string[];
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
};

/** What `scaffoldComposition` needs to create a composition from nothing. */
export type ScaffoldSpec = {
  id: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  title?: string;
  group?: string;
  description?: string;
  tags?: string[];
};

/** Where scaffold wrote. Paths are project-relative, ready to hand to editFile. */
export type ScaffoldResult = {
  id: string;
  metaPath: string;
  compositionPath: string;
};

/** One `tsc` diagnostic, with a project-relative file path. */
export type TypecheckDiagnostic = {
  file: string;
  line: number;
  column: number;
  /** e.g. "TS2322". */
  code: string;
  message: string;
};

export type TypecheckResult = {
  ok: boolean;
  diagnostics: TypecheckDiagnostic[];
};
```

- [ ] **Step 2: Verify**

```bash
test -f packages/editor/src/server/project/types.ts && echo OK
```

## Task A2: The file templates

**Files:** Create `packages/editor/src/server/project/templates.ts`

The tsconfig below is the one **verified to typecheck `@smoove/core` clean from the scratch dir**. Do not add a `paths` mapping — plain node resolution already finds the workspace symlink. Do not drop `"types": []` — it keeps ambient `@types/*` out.

- [ ] **Step 1: Write it**

```ts
import type { ScaffoldSpec } from "./types.js";

/**
 * The project's own tsconfig, written by `ProjectFs.init()`.
 *
 * `moduleResolution: "bundler"` matches how the compositions are actually
 * consumed (Vite). `types: []` keeps ambient @types/* out of the program — a
 * composition needs `@smoove/core` and nothing else. No `paths` mapping is
 * needed: node resolution walks up from `<root>/<id>/composition.ts` into the
 * host app's `node_modules`, where `@smoove/core` is symlinked.
 */
export const PROJECT_TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": []
  },
  "include": ["**/*.ts"]
}
`;

/**
 * A minimal-but-VALID composition: right dimensions, right clock, one empty
 * `main` sequence over a black background. It typechecks and renders on day
 * one — the agent then edits the animation into it.
 *
 * Scaffold is deterministic plumbing on purpose. The creative work is the
 * model's job, guided by the system prompt; a scaffold that guessed at content
 * would just be something the model has to undo.
 */
export function compositionStub(spec: ScaffoldSpec): string {
  return `import { Composition, Rect, Sequence } from "@smoove/core";

const width = ${spec.width};
const height = ${spec.height};
const fps = ${spec.fps};
const durationInFrames = ${spec.durationInFrames};

const comp = new Composition({
  id: ${JSON.stringify(spec.id)},
  fps,
  durationInFrames,
  width,
  height,
});

const main = new Sequence();
main.add(new Rect({ x: 0, y: 0, width, height, fill: "#000000" }));
comp.add(main);

export default comp;
`;
}
```

- [ ] **Step 2: Verify**

```bash
test -f packages/editor/src/server/project/templates.ts && echo OK
```

## Task A3: `ProjectFs` — the failing tests first

**Files:** Create `packages/editor/vitest.config.ts`, `packages/editor/test/project-fs.test.ts`; modify `packages/editor/package.json`

- [ ] **Step 1: Add Vitest to `packages/editor/package.json`**

Add to `scripts`:

```json
    "test": "vitest run",
    "test:watch": "vitest",
```

Add to `devDependencies` (keep the existing ones):

```json
    "typescript": "^6.0.3",
    "vitest": "^3.2.4"
```

> `typescript` is a **devDependency**, not a runtime dep: `typecheck` resolves the `tsc` binary from the *project root* (the host app) first, and only falls back to the editor package's own copy — which is what the Vitest temp-dir fixtures use.

- [ ] **Step 2: `packages/editor/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // `typecheck` spawns a real tsc; the first run pays for loading @smoove/core's d.ts.
    testTimeout: 60_000,
  },
});
```

> Tests live in `test/`, not `src/`, so the package's `tsconfig.json` (`"include": ["src"]`) leaves them out of `tsc -b` and they never land in `dist/`. No tsconfig change is needed.

- [ ] **Step 3: Install**

```bash
cd /Users/rotem/development/konva-motion
pnpm install
```

- [ ] **Step 4: `packages/editor/test/project-fs.test.ts`**

```ts
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProjectFs } from "../src/server/project/project-fs.js";

let root: string;
let project: ProjectFs;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "smoove-project-"));
  project = new ProjectFs(root);
  await project.init();
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
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
  it.each(["../escape.ts", "a/../../escape.ts", "/etc/passwd", ""])(
    "refuses %j",
    async (bad) => {
      await expect(project.read(bad)).rejects.toThrow(/outside the project/i);
    },
  );

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
```

- [ ] **Step 5: Run — verify it fails for the right reason**

```bash
pnpm --filter @smoove/editor run test
```
Expected: **FAIL** — cannot resolve `../src/server/project/project-fs.js`. That file is Task A4.

## Task A4: `ProjectFs` — the implementation

**Files:** Create `packages/editor/src/server/project/project-fs.ts`

- [ ] **Step 1: Write it**

```ts
import { execFile } from "node:child_process";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import { compositionStub, PROJECT_TSCONFIG } from "./templates.js";
import type {
  CompositionMeta,
  ScaffoldResult,
  ScaffoldSpec,
  TypecheckDiagnostic,
  TypecheckResult,
} from "./types.js";

const execFileAsync = promisify(execFile);

/** A composition id is also a directory name — keep it a boring slug. */
const ID = /^[a-z0-9][a-z0-9-]*$/;

/** `path/to/file.ts(12,5): error TS2322: Type 'x' is not assignable…` */
const DIAGNOSTIC = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.*)$/;

/**
 * A real, filesystem-backed smoove project: the source of the EDITOR's
 * composition list, deliberately separate from the studio's built-in demo
 * registry.
 *
 * Every composition is a directory of two files:
 *
 *   <root>/<id>/meta.json        the catalog row
 *   <root>/<id>/composition.ts   the animation code
 *
 * Plain Node — no React, no Vite, no HTTP — so it is directly unit-testable and
 * can be called outside any agent. Reads hit the disk on every call: a
 * composition the agent scaffolds mid-turn MUST be visible to its own next tool
 * call, which an in-memory registry could never do.
 */
export class ProjectFs {
  /** Absolute path to the project root. */
  readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  /** Create the root and write the project tsconfig. Idempotent; never clobbers. */
  async init(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const tsconfig = path.join(this.root, "tsconfig.json");
    if (!(await exists(tsconfig))) await writeFile(tsconfig, PROJECT_TSCONFIG, "utf8");
  }

  /**
   * Resolve a project-relative path, refusing anything that escapes the root.
   * Absolute paths and `..` traversal both land outside and are rejected — this
   * is the only place file paths enter the project, so it is the only wall the
   * agent's paths have to clear.
   */
  resolve(relPath: string): string {
    const abs = path.resolve(this.root, relPath);
    const rel = path.relative(this.root, abs);
    if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new Error(`Path is outside the project: ${relPath}`);
    }
    return abs;
  }

  /** Every composition's catalog row, sorted by id. Reads disk on every call. */
  async list(): Promise<CompositionMeta[]> {
    const dirents = await readdir(this.root, { withFileTypes: true });
    const metas: CompositionMeta[] = [];

    for (const dirent of dirents) {
      if (!dirent.isDirectory()) continue;
      const metaPath = path.join(this.root, dirent.name, "meta.json");
      if (!(await exists(metaPath))) continue; // not a composition; ignore.

      const raw = await readFile(metaPath, "utf8");
      try {
        metas.push(JSON.parse(raw) as CompositionMeta);
      } catch (error) {
        // Surface it — a broken meta.json the agent just wrote is exactly the
        // thing it needs told about, not silently hidden from the catalog.
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid JSON in ${dirent.name}/meta.json: ${reason}`);
      }
    }

    return metas.sort((a, b) => a.id.localeCompare(b.id));
  }

  async read(relPath: string): Promise<string> {
    const abs = this.resolve(relPath);
    try {
      return await readFile(abs, "utf8");
    } catch {
      throw new Error(`No such file in the project: ${relPath}`);
    }
  }

  /** Write a file, creating parent directories as needed. */
  async write(relPath: string, content: string): Promise<void> {
    const abs = this.resolve(relPath);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content, "utf8");
  }

  /**
   * Replace a UNIQUE occurrence of `oldString`. Zero matches and multiple
   * matches are both errors — the same semantics as the Edit tool models are
   * already trained on. Guessing which of two matches was meant is how you
   * corrupt a file.
   */
  async edit(relPath: string, oldString: string, newString: string): Promise<void> {
    const content = await this.read(relPath);
    const count = content.split(oldString).length - 1;
    if (count === 0) throw new Error(`String not found in ${relPath}: ${JSON.stringify(oldString)}`);
    if (count > 1) {
      throw new Error(
        `Ambiguous edit: ${count} matches in ${relPath}. Include more surrounding context to make it unique.`,
      );
    }
    await this.write(relPath, content.replace(oldString, newString));
  }

  /** Create a new composition: `meta.json` + a minimal, valid `composition.ts`. */
  async scaffold(spec: ScaffoldSpec): Promise<ScaffoldResult> {
    if (!ID.test(spec.id)) {
      throw new Error(
        `Invalid id ${JSON.stringify(spec.id)} — use lowercase kebab-case (e.g. "good-job").`,
      );
    }
    if (await exists(path.join(this.root, spec.id))) {
      throw new Error(`Composition "${spec.id}" already exists.`);
    }

    const meta: CompositionMeta = {
      id: spec.id,
      ...(spec.title !== undefined && { title: spec.title }),
      ...(spec.group !== undefined && { group: spec.group }),
      ...(spec.description !== undefined && { description: spec.description }),
      ...(spec.tags !== undefined && { tags: spec.tags }),
      width: spec.width,
      height: spec.height,
      fps: spec.fps,
      durationInFrames: spec.durationInFrames,
    };

    const metaPath = `${spec.id}/meta.json`;
    const compositionPath = `${spec.id}/composition.ts`;
    await this.write(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
    await this.write(compositionPath, compositionStub(spec));

    return { id: spec.id, metaPath, compositionPath };
  }

  /**
   * Run the TypeScript compiler over the project. This is the agent's
   * self-correction signal: it writes code, checks, reads the diagnostics, and
   * fixes — which is why it must be a real `tsc` run and not a syntax-only
   * transform.
   */
  async typecheck(): Promise<TypecheckResult> {
    const tsc = this.#resolveTsc();
    const args = [tsc, "--noEmit", "--pretty", "false", "-p", path.join(this.root, "tsconfig.json")];

    let output: string;
    try {
      const { stdout } = await execFileAsync(process.execPath, args, { cwd: this.root });
      output = stdout;
    } catch (error) {
      // tsc exits 2 when it found errors, and execFile rejects on any nonzero
      // exit — so the diagnostics we actually want live on the REJECTED error.
      const stdout = (error as { stdout?: string }).stdout;
      if (typeof stdout !== "string") throw error; // a real failure (tsc missing, etc.)
      output = stdout;
    }

    const diagnostics = output
      .split("\n")
      .map((line) => this.#parseDiagnostic(line))
      .filter((d): d is TypecheckDiagnostic => d !== null);

    return { ok: diagnostics.length === 0, diagnostics };
  }

  #parseDiagnostic(line: string): TypecheckDiagnostic | null {
    const match = DIAGNOSTIC.exec(line.trim());
    if (!match) return null;
    const [, file, lineNo, column, code, message] = match;
    if (!file || !lineNo || !column || !code || message === undefined) return null;
    return {
      file: path.relative(this.root, path.resolve(this.root, file)),
      line: Number(lineNo),
      column: Number(column),
      code,
      message,
    };
  }

  /**
   * Prefer the HOST APP's TypeScript (it owns the project and its deps); fall
   * back to this package's own copy, which is what a temp-dir test fixture uses.
   */
  #resolveTsc(): string {
    try {
      return createRequire(path.join(this.root, "noop.js")).resolve("typescript/bin/tsc");
    } catch {
      return createRequire(import.meta.url).resolve("typescript/bin/tsc");
    }
  }
}

async function exists(abs: string): Promise<boolean> {
  try {
    await access(abs);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Run the tests**

```bash
pnpm --filter @smoove/editor run test
```
Expected: **PASS** — all of `test/project-fs.test.ts`.

> `typecheck` has no test yet; it gets one in Task B4 where the write tools are covered.

---

# Part B — The write tools

## Task B1: Rewire the tool context

**Files:** Modify `packages/editor/src/server/tools/context.ts`, `packages/editor/src/server/tools/compositions.ts`

This is the change that fixes the Phase 1 problem: **the editor's composition list stops being the studio's demo registry.**

- [ ] **Step 1: Replace `tools/context.ts` entirely**

```ts
import type { EditorContext } from "../../types.js";
import type { ProjectFs } from "../project/project-fs.js";

/**
 * What every tool is handed.
 *
 * `project` is the filesystem-backed project — the source of the EDITOR's
 * composition list, deliberately NOT the studio's built-in demo registry.
 * `context` is the per-turn browser snapshot (only the browser knows the
 * playhead) and is absent when a tool is called directly, outside a
 * conversation.
 */
export type EditorToolContext = {
  project: ProjectFs;
  context?: EditorContext;
};
```

- [ ] **Step 2: Replace `tools/compositions.ts` entirely**

`CompositionSummary` and the `registry.entries()` read are both gone; the list now comes from disk.

```ts
import type { CompositionMeta } from "../project/types.js";
import type { EditorToolContext } from "./context.js";

/**
 * The project's compositions. Reads the filesystem on every call, so a
 * composition scaffolded earlier in THIS turn is visible to the next tool call.
 * Plain function — callable directly, no LLM required.
 */
export function listCompositions(ctx: EditorToolContext): Promise<CompositionMeta[]> {
  return ctx.project.list();
}
```

- [ ] **Step 3: Verify the old registry coupling is gone**

```bash
grep -rn "registry" packages/editor/src/server/ || echo "OK: no registry left in editor/server"
```
Expected: `OK`. (`src/server/ai.ts` still references it — Task B5 removes that. If this grep only shows `ai.ts`, that is expected at this point.)

## Task B2: `readFile` / `writeFile` / `editFile`

**Files:** Create `packages/editor/src/server/tools/files.ts`

- [ ] **Step 1: Write it**

```ts
import type { EditorToolContext } from "./context.js";

export type ReadFileInput = { path: string };
export type WriteFileInput = { path: string; content: string };
export type EditFileInput = { path: string; oldString: string; newString: string };

/** Read a project file. Plain function — callable directly, no LLM required. */
export function readFile(ctx: EditorToolContext, input: ReadFileInput): Promise<string> {
  return ctx.project.read(input.path);
}

/** Create or overwrite a project file. Plain function. */
export async function writeFile(
  ctx: EditorToolContext,
  input: WriteFileInput,
): Promise<{ path: string; bytes: number }> {
  await ctx.project.write(input.path, input.content);
  return { path: input.path, bytes: Buffer.byteLength(input.content, "utf8") };
}

/** Replace a unique string in a project file. Plain function. */
export async function editFile(
  ctx: EditorToolContext,
  input: EditFileInput,
): Promise<{ path: string; ok: true }> {
  await ctx.project.edit(input.path, input.oldString, input.newString);
  return { path: input.path, ok: true };
}
```

## Task B3: `scaffoldComposition` + `typecheck`

**Files:** Create `packages/editor/src/server/tools/scaffold.ts`, `packages/editor/src/server/tools/typecheck.ts`

- [ ] **Step 1: `tools/scaffold.ts`**

```ts
import type { ScaffoldResult, ScaffoldSpec } from "../project/types.js";
import type { EditorToolContext } from "./context.js";

/**
 * Create a new composition: `<id>/meta.json` + a minimal, valid
 * `<id>/composition.ts` (right size, right clock, empty black stage). Author the
 * actual motion afterwards with `editFile`. Plain function.
 */
export function scaffoldComposition(
  ctx: EditorToolContext,
  spec: ScaffoldSpec,
): Promise<ScaffoldResult> {
  return ctx.project.scaffold(spec);
}
```

- [ ] **Step 2: `tools/typecheck.ts`**

```ts
import type { TypecheckResult } from "../project/types.js";
import type { EditorToolContext } from "./context.js";

/**
 * Typecheck every composition in the project. Plain function — this is the
 * agent's self-correction signal, so it runs the real compiler, not a
 * syntax-only transform.
 */
export function typecheck(ctx: EditorToolContext): Promise<TypecheckResult> {
  return ctx.project.typecheck();
}
```

## Task B4: Test the write tools + typecheck

**Files:** Create `packages/editor/test/tools.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProjectFs } from "../src/server/project/project-fs.js";
import { listCompositions } from "../src/server/tools/compositions.js";
import type { EditorToolContext } from "../src/server/tools/context.js";
import { editFile, readFile, writeFile } from "../src/server/tools/files.js";
import { scaffoldComposition } from "../src/server/tools/scaffold.js";
import { typecheck } from "../src/server/tools/typecheck.js";

let root: string;
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
  root = await mkdtemp(path.join(tmpdir(), "smoove-tools-"));
  const project = new ProjectFs(root);
  await project.init();
  ctx = { project };
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
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
    expect(result.diagnostics.length).toBeGreaterThan(0);

    const first = result.diagnostics[0];
    expect(first?.file).toBe("good-job/composition.ts");
    expect(first?.code).toMatch(/^TS\d+$/);
    expect(first?.line).toBeGreaterThan(0);
    expect(first?.message).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run**

```bash
pnpm --filter @smoove/editor run test
```
Expected: **PASS**, all files. The `typecheck` cases spawn a real `tsc` and take a few seconds — that is why `testTimeout` is 60s.

> If `#resolveTsc` cannot find TypeScript from the temp dir, the fallback to the package's own `typescript` devDependency is what saves this test. If it still fails, confirm `packages/editor/node_modules/typescript` exists after `pnpm install`.

## Task B5: Register the tools + rewire `setupAi`

**Files:** Modify `packages/editor/src/server/tools/index.ts`, `packages/editor/src/server/ai.ts`

- [ ] **Step 1: Replace `tools/index.ts` entirely**

Keep the `: ToolSet` annotation — without it tsc emits TS2883 (Phase 1 gotcha).

```ts
import { type ToolSet, tool } from "ai";
import { z } from "zod";
import { listCompositions } from "./compositions.js";
import type { EditorToolContext } from "./context.js";
import { editFile, readFile, writeFile } from "./files.js";
import { scaffoldComposition } from "./scaffold.js";
import { getTimeline } from "./timeline.js";
import { typecheck } from "./typecheck.js";

/**
 * The opinionated default toolkit: read the project, author into it, and check
 * the work. Every tool here is ALSO exported as a plain function you can call
 * directly — see the package's server barrel.
 *
 * The return type MUST stay annotated `ToolSet`, or tsc leaks unnameable
 * @ai-sdk internals into the emitted .d.ts (TS2883).
 */
export function getDefaultSmooveEditorTools(ctx: EditorToolContext): ToolSet {
  return {
    listCompositions: tool({
      description: "List the compositions in the project, with their size and timing.",
      inputSchema: z.object({}),
      execute: async () => listCompositions(ctx),
    }),

    getTimeline: tool({
      description:
        "Get the active composition's timeline: current frame, fps, total duration, and each sequence's frame range.",
      inputSchema: z.object({}),
      execute: async () => getTimeline(ctx),
    }),

    readFile: tool({
      description: "Read a file from the project, e.g. 'good-job/composition.ts'.",
      inputSchema: z.object({
        path: z.string().describe("Project-relative path."),
      }),
      execute: async (input) => readFile(ctx, input),
    }),

    writeFile: tool({
      description:
        "Create or overwrite a project file with its full contents. To change part of an existing file, prefer editFile.",
      inputSchema: z.object({
        path: z.string().describe("Project-relative path."),
        content: z.string().describe("The complete new contents of the file."),
      }),
      execute: async (input) => writeFile(ctx, input),
    }),

    editFile: tool({
      description:
        "Replace an exact, unique string in a project file. Fails if the string is missing or appears more than once — include surrounding context to make it unique.",
      inputSchema: z.object({
        path: z.string().describe("Project-relative path."),
        oldString: z.string().describe("The exact text to replace. Must appear exactly once."),
        newString: z.string().describe("The replacement text."),
      }),
      execute: async (input) => editFile(ctx, input),
    }),

    scaffoldComposition: tool({
      description:
        "Create a new composition: writes <id>/meta.json and a minimal valid <id>/composition.ts (correct size and clock, empty black stage). Author the motion afterwards with editFile.",
      inputSchema: z.object({
        id: z.string().describe('Lowercase kebab-case id and directory name, e.g. "good-job".'),
        width: z.number().int().positive().describe("Pixels, e.g. 1080."),
        height: z.number().int().positive().describe("Pixels, e.g. 1920."),
        fps: z.number().int().positive().describe("Frames per second, e.g. 30."),
        durationInFrames: z
          .number()
          .int()
          .positive()
          .describe("Total length in frames — seconds x fps."),
        title: z.string().optional(),
        group: z.string().optional(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }),
      execute: async (input) => scaffoldComposition(ctx, input),
    }),

    typecheck: tool({
      description:
        "Typecheck every composition in the project with the TypeScript compiler. Run this after every edit and fix what it reports.",
      inputSchema: z.object({}),
      execute: async () => typecheck(ctx),
    }),
  };
}

export type EditorToolSet = ReturnType<typeof getDefaultSmooveEditorTools>;

export { listCompositions } from "./compositions.js";
export type { EditorToolContext } from "./context.js";
export {
  editFile,
  type EditFileInput,
  readFile,
  type ReadFileInput,
  writeFile,
  type WriteFileInput,
} from "./files.js";
export { scaffoldComposition } from "./scaffold.js";
export { getTimeline } from "./timeline.js";
export { typecheck } from "./typecheck.js";
```

- [ ] **Step 2: In `src/server/ai.ts`, swap `registry` for `project`**

Replace the import block, the `SetupAiOptions` type, the `DEFAULT_SYSTEM` constant, and the `makeTools` call. Everything else (the `pick`, the `streamText` call, the `await convertToModelMessages`) is unchanged.

```ts
import { convertToModelMessages, isStepCount, streamText, type ToolSet } from "ai";
import type { AgentInput, AiRuntime, ModelInfo, ModelSpec } from "../types.js";
import type { ProjectFs } from "./project/project-fs.js";
import { smooveVideoSystemPrompt } from "./system-prompt.js";
import { type EditorToolContext, getDefaultSmooveEditorTools } from "./tools/index.js";

export type SetupAiOptions = {
  /** The filesystem-backed project the agent reads and writes. This — NOT the
      studio's demo registry — is the editor's composition list. */
  project: ProjectFs;
  /** User-selectable models, built with `defineModel`. The first is the default. */
  models: ModelSpec[];
  /** Override the toolkit. Receives the per-turn context. */
  tools?: (ctx: EditorToolContext) => ToolSet;
  /** Override the built-in system prompt (which teaches the model to write smoove). */
  system?: string;
  /** Max tool-calling steps per turn. Authoring needs room: scaffold, edit,
      typecheck, fix, typecheck again. */
  maxSteps?: number;
};
```

In the body, replace the three lines that referenced `registry` / `DEFAULT_SYSTEM`:

```ts
  const system = options.system ?? smooveVideoSystemPrompt;
  const maxSteps = options.maxSteps ?? 32;
  const makeTools = options.tools ?? getDefaultSmooveEditorTools;
```

and inside `stream()`:

```ts
      const tools = makeTools({ project: options.project, context: input.context });
```

Delete the old `DEFAULT_SYSTEM` constant. `tools` is now typed `ToolSet`, so the `tools as Parameters<typeof streamText>[0]["tools"]` cast can go — pass `tools` directly. If tsc objects, keep the cast rather than widening `ToolSet`.

> `maxSteps` goes from 16 to 32: one authoring turn is scaffold → write → typecheck → fix → typecheck, and 16 steps runs out on a model that iterates.

## Task B6: The system prompt

**Files:** Create `packages/editor/src/server/system-prompt.ts`

Bundled into the package on purpose: a published `@smoove/editor` has to teach a model to write smoove **without** the consumer having this repo's `skills/` directory.

- [ ] **Step 1: Write it**

```ts
/**
 * The default system prompt: a distilled `smoove-video` skill, bundled into the
 * package.
 *
 * This is deliberately not read off disk. The published package IS the product,
 * and "LLM-authorable" is the pillar it exists to prove — a consumer who has
 * never seen this repo's skills/ directory must still get a model that writes
 * idiomatic smoove. Keep it in sync with skills/smoove-video/SKILL.md when that
 * changes materially.
 */
export const smooveVideoSystemPrompt = `You are smoove, an agent that authors timeline-driven Konva animations by writing TypeScript.

# The project

You work in a real project on disk. Each composition is a directory:

  <id>/meta.json        the catalog row (id, title, width, height, fps, durationInFrames)
  <id>/composition.ts   the animation code, default-exporting a Composition

Use listCompositions to see what exists, readFile/writeFile/editFile to change it,
scaffoldComposition to create one, and typecheck to check your work.

# How to author

1. scaffoldComposition with the right size and clock. It writes a minimal, valid
   composition: an empty black stage. Duration in FRAMES = seconds x fps.
2. editFile (or writeFile for a full rewrite) to author the motion.
3. typecheck. Read the diagnostics. Fix them. Typecheck again.
4. Do not stop while typecheck still reports errors.

# The mental model

Composition extends Konva.Stage and owns the frame clock (fps + durationInFrames).
Sequence extends Konva.Layer and is range-gated: visible and ticked only while the
playhead is inside [from, from + durationInFrames).

You animate by mutating Konva node properties inside sequence.register((frame) => {...}).
It is imperative, per-frame, pull-based, and A PURE FUNCTION OF THE FRAME.

  const seq = new Sequence({ from: 0, durationInFrames: 90 });
  seq.register((frame) => { node.opacity(frame / 90); });

The updater receives the sequence-LOCAL frame (0 at the sequence's start).

NEVER use: CSS transitions, React, setInterval, requestAnimationFrame, Konva.Tween,
Date.now(), or Math.random(). Anything not derived from the frame breaks scrubbing
and headless rendering, even though it looks fine during live playback.

Import the whole drawing vocabulary from "@smoove/core" — Composition, Sequence,
Rect, Circle, Text, Image, Flex, Block, interpolate, Easing — not from Konva directly.

# Animating

interpolate(frame, inputRange, outputRange, options) is the workhorse:

  import { Easing, interpolate } from "@smoove/core";

  const opacity = interpolate(frame, [0, 30], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

ALWAYS pass extrapolateLeft/extrapolateRight: "clamp" for a fade or a move, or the
value keeps going past the end of its range.

Easing: Easing.in/out/inOut(Easing.cubic | quad | back(n) | elastic(n) | bounce),
or Easing.bezier(...). "Natural and smooth" means an ease-out on entrances
(Easing.out(Easing.cubic)) — things arrive by decelerating.

To fade something in and out in one sequence, take the MINIMUM of a rising and a
falling interpolate:

  const alpha = Math.min(
    interpolate(f, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(f, [total - 20, total], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );

# Layout

Flex and Block give CSS-flexbox-like auto layout (flexDirection, justifyContent,
alignItems, gap, padding; Block also does gradients, shadows, borders, cornerRadius).
Reflow is automatic.

CRITICAL GOTCHA: a Flex/Block child's x(), y(), width() and height() are OVERWRITTEN
every tick by the layout pass, which runs AFTER your updaters. Animating them does
nothing. Animate opacity(), scale(), rotation(), or flex props (flexGrow, gap,
padding) instead. If you need to animate position directly, do not put the node in a
Flex — position it yourself.

# Text

Text extends Konva.Group, NOT Konva.Text. Change its content with setText(), never
.text(). It supports fitText, maxLines/ellipsis, a built-in typewriter reveal, and
highlights. To center a Text, give it the full stage width and align: "center".
To scale or rotate it around its middle, set offsetX/offsetY to half its size and
position it by its center.

# Performance

NEVER use shadowBlur in an animated scene — canvas shadow blur re-runs per shape per
frame and dominates the profile. Fake a glow with a radial-gradient fill instead.

# Working style

Be concise. Author real, complete code — no placeholders, no "// add animation here".
Prefer editFile over writeFile for a change to an existing file. Always finish by
typechecking clean.`;
```

- [ ] **Step 2: Sanity-check it is a plain string with no template-literal landmines**

The prompt contains backticks nowhere, but it DOES contain `${`-free text — confirm:

```bash
grep -n '\${' packages/editor/src/server/system-prompt.ts || echo "OK: no accidental interpolation"
```
Expected: `OK`.

## Task B7: The server barrel

**Files:** Modify `packages/editor/src/server/index.ts`

- [ ] **Step 1: Replace it entirely, then format**

```ts
/** @smoove/editor/server — Node-only. Contracts + runtime + toolkit, NO HTTP.
    The host app wires the transport (see kitchen-sink's routes/api.agent.ts).

    Every tool is exported twice: as part of getDefaultSmooveEditorTools() for
    the agent, and as a plain function you can call directly. */

export type * from "../types.js";
export { type SetupAiOptions, setupAi } from "./ai.js";
export { defineModel } from "./models.js";
export { ProjectFs } from "./project/project-fs.js";
export type * from "./project/types.js";
export { smooveVideoSystemPrompt } from "./system-prompt.js";
export {
  type EditFileInput,
  editFile,
  type EditorToolContext,
  type EditorToolSet,
  getDefaultSmooveEditorTools,
  getTimeline,
  listCompositions,
  type ReadFileInput,
  readFile,
  scaffoldComposition,
  typecheck,
  type WriteFileInput,
  writeFile,
} from "./tools/index.js";
```

- [ ] **Step 2: Build the package**

```bash
cd /Users/rotem/development/konva-motion
pnpm exec biome check --write packages/editor/src/server/index.ts packages/editor/src/server/tools/index.ts
pnpm --filter @smoove/editor run build
```
Expected: exit 0. If tsc reports **TS2883** on `getDefaultSmooveEditorTools`, the `: ToolSet` annotation was dropped — put it back.

---

# Part C — kitchen-sink: the editor's own list

## Task C1: The scratch project directory

**Files:** Create `packages/kitchen-sink/editor-project/.gitkeep`; modify `.gitignore`

The project is a **gitignored scratch dir** — but the directory itself must exist on a fresh clone, or Vite has nothing to glob and no directory to watch. `.gitkeep` is tracked; everything else in there is not.

- [ ] **Step 1: Create the directory and the keepfile**

```bash
cd /Users/rotem/development/konva-motion
mkdir -p packages/kitchen-sink/editor-project
touch packages/kitchen-sink/editor-project/.gitkeep
```

- [ ] **Step 2: Append to the root `.gitignore`**

```gitignore
# The editor's scratch project — agent-authored compositions, not repo source.
# The directory itself is kept (Vite must have something to glob and watch).
packages/kitchen-sink/editor-project/*
!packages/kitchen-sink/editor-project/.gitkeep
```

- [ ] **Step 3: Verify git agrees**

```bash
git check-ignore -v packages/kitchen-sink/editor-project/foo/meta.json && \
git check-ignore -v packages/kitchen-sink/editor-project/.gitkeep; \
echo "expect: first line matched, second line NOT matched (exit 1)"
```
Expected: the `foo/meta.json` path prints a match; `.gitkeep` prints nothing.

## Task C2: The editor registry

**Files:** Create `packages/kitchen-sink/src/editor-registry.ts`

- [ ] **Step 1: Write it**

```ts
import { defineRegistry, type RegistryEntry } from "@smoove/studio";

/** The shape of a composition's `meta.json`. Mirrors `CompositionMeta` in
    `@smoove/editor/server` — duplicated here because this module is browser
    code and must not import the Node-only server barrel. */
type Meta = {
  id: string;
  title?: string;
  group?: string;
  description?: string;
  tags?: string[];
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
};

/**
 * The EDITOR's composition list — the agent's `editor-project/` directory, kept
 * strictly separate from `registry.ts` (the studio's built-in demo catalog,
 * which still owns `/` and `/c/:id`).
 *
 * Two globs, because the two halves have different costs: `meta.json` is a
 * cheap catalog row and is loaded EAGERLY; `composition.ts` builds a whole
 * Konva scene and stays LAZY, exactly the split RegistryEntry already models.
 *
 * When the agent writes a new composition directory, Vite's watcher sees a file
 * matching these patterns and reloads this module, so the composition appears.
 * That reload is a full page reload (glob membership is not hot-swappable) and
 * therefore drops in-memory chat history — a known Phase 2 wrinkle.
 */
const metas = import.meta.glob<Meta>("../editor-project/*/meta.json", {
  eager: true,
  import: "default",
});
const compositions = import.meta.glob("../editor-project/*/composition.ts");

function toEntries(): RegistryEntry[] {
  const entries: RegistryEntry[] = [];

  for (const [metaPath, meta] of Object.entries(metas)) {
    const dir = metaPath.slice(0, metaPath.lastIndexOf("/"));
    const load = compositions[`${dir}/composition.ts`];
    // A meta.json with no composition.ts is a half-written composition; skip it
    // rather than handing the studio an entry that can never load.
    if (!load) continue;

    entries.push({
      id: meta.id,
      title: meta.title ?? meta.id,
      group: meta.group,
      description: meta.description,
      tags: meta.tags,
      composition: load as RegistryEntry["composition"],
    });
  }

  return entries.sort((a, b) => a.id.localeCompare(b.id));
}

export default defineRegistry(toEntries());
```

> **Do not** rewrite the default export as `defineRegistry([...])` with a literal array. `@smoove/vite`'s registry transform only fires on a literal `ArrayExpression` argument; the `toEntries()` call is what keeps the plugin's HMR rewriting (which is built for statically-imported demo entries) safely switched off here.

## Task C3: Point the agent at the project

**Files:** Modify `packages/kitchen-sink/src/server/ai.server.ts`

- [ ] **Step 1: Replace the imports and `getAi`** (leave `buildModels()` exactly as it is)

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defineModel, type ModelSpec, ProjectFs, setupAi } from "@smoove/editor/server";
```

Note the removed `import registry from "../registry.js"` — the agent no longer sees the demo catalog at all.

Then replace `getAi`:

```ts
/** The editor's project: a real directory the agent reads and writes. This is
    the editor's composition list — deliberately NOT the demo registry that
    powers `/` and `/c/:id`. Gitignored scratch; created on first use. */
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../editor-project",
);

export const project = new ProjectFs(projectRoot);

/** Lazily constructed so a missing key surfaces as a request error rather than
    crashing the dev server at import time. */
let cached: ReturnType<typeof setupAi> | null = null;

export async function getAi() {
  if (!cached) {
    await project.init();
    cached = setupAi({ project, models: buildModels() });
  }
  return cached;
}
```

> `getAi()` is now **async** (it has to `init()` the project directory). Task C4 updates both callers.

- [ ] **Step 2: Confirm the path resolves**

`src/server/ai.server.ts` → `../../editor-project` = `packages/kitchen-sink/editor-project`. Under Vite SSR the module URL is the source path, so this is correct in dev. Verify in Task E2 by checking the directory the agent actually writes into.

## Task C4: Update the two API routes for the async `getAi`

**Files:** Modify `packages/kitchen-sink/src/routes/api.agent.ts`, `packages/kitchen-sink/src/routes/api.agent.models.ts`

- [ ] **Step 1: `api.agent.models.ts`**

```ts
import { getAi } from "../server/ai.server.js";

/** GET /api/agent/models — key-free model list for the picker. */
export async function loader() {
  try {
    const ai = await getAi();
    return Response.json(ai.models());
  } catch {
    // Provider not configured yet — an empty picker is the correct UI.
    return Response.json([]);
  }
}
```

- [ ] **Step 2: In `api.agent.ts`, await `getAi()`**

Change the one line inside the `try`:

```ts
    const ai = await getAi();
    const result = await ai.stream(body, request.signal);
```

Leave the rest of the file (the `createUIMessageStreamResponse` / `toUIMessageStream` call and the catch) untouched.

## Task C5: The editor frame uses the editor's registry

**Files:** Modify `packages/kitchen-sink/src/layouts/editor-layout.tsx`, `packages/kitchen-sink/src/routes/editor.tsx`

- [ ] **Step 1: Replace `layouts/editor-layout.tsx`**

The `render` backend is dropped: `/api/render` resolves ids through the **demo** registry (`server/resolve.ts`), so a project id would never resolve. `StudioProps.render` is optional, so omitting it makes the render affordance degrade instead of failing at the click. Server-render of project compositions is explicitly out of scope for Phase 2.

```tsx
import { Editor } from "@smoove/editor";
import { Studio } from "@smoove/studio";
import { Outlet, useNavigate } from "react-router";
import editorRegistry from "../editor-registry.js";

export default function EditorLayout() {
  const navigate = useNavigate();
  return (
    <Studio
      registry={editorRegistry}
      onNavigate={(id) => navigate(`/editor?c=${id}`)}
    >
      <Studio.Body>
        <Editor.ChatRail endpoint="/api/agent" />
        <Outlet />
      </Studio.Body>
      <Studio.Toasts />
    </Studio>
  );
}
```

- [ ] **Step 2: Replace `routes/editor.tsx`**

Keeps the end-of-Phase-1 `?c=` / first-entry selection (the fix this phase finally verifies in a browser), and adds the empty state the gitignored scratch dir makes reachable on a fresh clone.

```tsx
import { Studio, useStudio } from "@smoove/studio";
import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { ClientOnly } from "../components/client-only.js";
import editorRegistry from "../editor-registry.js";

/** The project starts empty — say so, instead of showing a blank stage. */
function EmptyProject() {
  return (
    <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-2 text-center">
      <p className="font-display text-ink-1">No compositions yet</p>
      <p className="max-w-xs text-sm text-ink-3">
        Describe one in the chat and smoove will write it into the project.
      </p>
    </div>
  );
}

export default function EditorRoute() {
  const store = useStudio();
  const [params] = useSearchParams();
  // The editor has no library sidebar, so nothing else selects a composition.
  // Load the one named by `?c=<id>` (written by the layout's onNavigate), or
  // fall back to the first entry — otherwise the stage stays blank and
  // getTimeline has no playhead to report.
  const id = params.get("c") ?? editorRegistry.entries()[0]?.id;

  // biome-ignore lint/correctness/useExhaustiveDependencies: store is stable.
  useEffect(() => {
    if (id) store.syncSelected(id);
  }, [id]);

  return (
    <Studio.Main>
      <ClientOnly fallback={<div className="flex-1 min-h-0" />}>
        {() =>
          id ? (
            <>
              <Studio.Stage />
              <Studio.Timeline />
            </>
          ) : (
            <EmptyProject />
          )
        }
      </ClientOnly>
    </Studio.Main>
  );
}
```

---

# Part D — Workspace wiring

## Task D1: A root `test` script

**Files:** Modify `package.json` (root)

- [ ] **Step 1: Add to root `scripts`**

```json
    "test": "pnpm -r --if-present run test",
```

- [ ] **Step 2: Verify it reaches the editor's tests**

```bash
cd /Users/rotem/development/konva-motion
pnpm test
```
Expected: the editor's suite runs and passes; every other package is skipped (`--if-present`).

## Task D2: The changeset (hand-written)

**Files:** Create `.changeset/editor-authoring.md`

`pnpm changeset` is interactive — write the file directly.

- [ ] **Step 1: Write it**

```markdown
---
"@smoove/editor": minor
---

Author compositions, not just inspect them.

The editor now works against a real, filesystem-backed project — `ProjectFs` — which is the source of its own composition list, separate from the studio's demo registry. New write tools (`readFile`, `writeFile`, `editFile`, `scaffoldComposition`, `typecheck`) sit alongside the read tools in `getDefaultSmooveEditorTools()`, and each is also exported as a plain function you can call without an LLM. The default system prompt now carries a distilled smoove-video guide, so the agent writes idiomatic `Composition`/`Sequence`/`interpolate` code.

**Breaking:** `setupAi({ registry })` is now `setupAi({ project })`, taking a `ProjectFs` instead of a studio `Registry`. `EditorToolContext` changes to match, and `listCompositions` returns `CompositionMeta[]` (from the project's `meta.json` files) instead of registry entries.
```

---

# Part E — Verification

## Task E1: Build, lint, test

- [ ] **Step 1: Everything builds**

```bash
cd /Users/rotem/development/konva-motion
pnpm build
```
Expected: exit 0.

- [ ] **Step 2: Lint clean**

```bash
pnpm format
pnpm check
```
Expected: `pnpm check` exits 0. (The vendored `ai-elements`/`ui` trees stay excluded — do not reformat them.)

- [ ] **Step 3: Tests pass**

```bash
pnpm test
```
Expected: every test in `packages/editor/test/` passes, including the two that spawn a real `tsc`.

- [ ] **Step 4: No new typecheck errors in kitchen-sink**

```bash
pnpm --filter @smoove/kitchen-sink run typecheck 2>&1 | grep -E "^[a-z].*error TS" | sed 's/(.*//' | sort | uniq -c
```
Expected: the pre-existing baseline only (`vite.config.ts` TS2769, `composition.ts` TS2532). Any **new** error code is a regression from this phase — fix it.

## Task E2: The direct-call API (no LLM)

This is the load-bearing proof that the toolkit is callable outside an agent — the same contract Phase 1 established, now for the write side.

- [ ] **Step 1: Scaffold, typecheck and list a composition with no model in the loop**

The project root must live **inside the host app**. `typecheck` runs a real `tsc`, and tsc resolves `@smoove/core` by walking up into `node_modules` — an OS tmpdir (`/tmp`, `/var/folders/…`) is outside the workspace and every composition there fails with **TS2307 "Cannot find module '@smoove/core'"**. That is not a quirk of the test: it is how the tool behaves anywhere the project is not inside an app that depends on smoove.

```bash
cd /Users/rotem/development/konva-motion
pnpm --filter @smoove/kitchen-sink exec node --input-type=module -e "
import { ProjectFs, listCompositions, scaffoldComposition, typecheck } from '@smoove/editor/server';
const project = new ProjectFs('./.direct-call-tmp');
await project.init();
const ctx = { project };
console.log('scaffold:', await scaffoldComposition(ctx, {
  id: 'direct-call', width: 1080, height: 1920, fps: 30, durationInFrames: 900,
}));
console.log('typecheck:', JSON.stringify(await typecheck(ctx)));
console.log('list:', JSON.stringify(await listCompositions(ctx)));
"
rm -rf packages/kitchen-sink/.direct-call-tmp
```
Expected: the scaffold result, then `{"ok":true,"diagnostics":[]}`, then a one-entry list.

## Task E3: The agent, end to end, against local Ollama

**The gate here is that the LOOP works** — the agent scaffolds, writes, typechecks clean, and the composition appears in the editor. A 9-billion-parameter model's *aesthetic* judgement is not the gate; the authoring pipeline is.

- [ ] **Step 1: Point the app at Ollama and boot**

```bash
cd /Users/rotem/development/konva-motion
cat >> packages/kitchen-sink/.env <<'ENV'
SMOOVE_LOCAL_MODEL=ornith:9b
SMOOVE_LOCAL_BASE_URL=http://localhost:11434/v1
ENV
pnpm dev
```
kitchen-sink serves on **http://localhost:5190** (per its launch config — not 5174).

- [ ] **Step 2: The model list still works**

```bash
curl -s http://localhost:5190/api/agent/models
```
Expected: `[{"id":"…","label":"ornith:9b (local)"}]`. **Never contains an `apiKey`.**

- [ ] **Step 3: The empty project lists as empty**

```bash
curl -sN -X POST http://localhost:5190/api/agent \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"id":"1","role":"user","parts":[{"type":"text","text":"List the compositions in the project."}]}]}' | head -40
```
Expected: a UI-message stream containing a `tool-listCompositions` part that reaches an output-available state with an **empty** array. This is the proof that the editor is no longer reading the 48-entry demo registry.

- [ ] **Step 4: The driving use case**

```bash
curl -sN -X POST http://localhost:5190/api/agent \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"id":"1","role":"user","parts":[{"type":"text","text":"Create a new composition: IG-story resolution (1080x1920), 30s at 30fps. Fade in to a configurable background color, then a big two-word headline (e.g. Good Job / You Rock) centered, each word on its own centered line, animating in naturally and smoothly. At the end, everything fades out to black."}]}]}'
```
Expected in the stream: `tool-scaffoldComposition` → `tool-editFile` (or `writeFile`) → `tool-typecheck`. Then on disk:

```bash
ls -R packages/kitchen-sink/editor-project/
cat packages/kitchen-sink/editor-project/*/meta.json
```
Expected: a composition directory with `meta.json` (`width: 1080, height: 1920, fps: 30, durationInFrames: 900`) and a `composition.ts`.

- [ ] **Step 5: The written composition actually typechecks**

Independently of what the agent claims:

```bash
pnpm exec tsc --noEmit --pretty false -p packages/kitchen-sink/editor-project/tsconfig.json && echo "CLEAN"
```
Expected: `CLEAN`. If the model left errors behind, that is a *model* limitation, not a pipeline bug — but the `typecheck` tool must have **reported** them. Confirm the diagnostics appeared in the stream; if the agent never called `typecheck`, strengthen the system prompt's step 4.

> **Outcome on 2026-07-14 with `ornith:9b` — recorded honestly:**
> - **Run 1:** the agent called `scaffoldComposition` (correctly deriving 1080×1920 / 30fps / **900 frames** from the prose) then `readFile`, then **narrated code in prose** and stopped. No `writeFile`, no `typecheck`.
> - **Fix applied:** the system prompt never said *code only reaches the project through the tools*. Added that, plus "a turn is only complete when typecheck has returned ok". (This is the step-4 strengthening this task anticipated.)
> - **Run 2:** the agent called `scaffoldComposition` → `writeFile`. It still **never called `typecheck`**, and the file it wrote does not compile (`TS2355`, `TS2554` — stub functions returning `null as any`, `interpolate` called with 6 args).
>
> **Conclusion:** the *pipeline* is sound — `typecheck` correctly caught the model's broken code, and the tools, project, registry and browser round-trip all work (proven by E1, E2, the browser steps below, and 22 unit tests). What a 9B model cannot do is author correct smoove code or reliably self-correct. **The tool loop is not gated on model quality, but this end-to-end demo is.** Re-run against a frontier model to see the loop close on the model's own output. To keep the browser gate meaningful, the composition below was authored through the **same `writeFile` + `typecheck` tools** the agent calls (see `E3 step 5b`), which returned `{"ok":true,"diagnostics":[]}`.

- [ ] **Step 5b: Close the loop through the tools, independent of model quality**

Author the driving use case by calling `writeFile` and `typecheck` directly (the same code paths the agent invokes), so the browser steps below verify the *pipeline* rather than the model. Keep the `meta.json` the agent scaffolded — it was correct. Expected: `writeFile` returns a byte count, `typecheck` returns `{"ok":true,"diagnostics":[]}`, and `listCompositions` shows the composition.

- [ ] **Step 6: Browser — the composition renders, and `getTimeline` round-trips**

Load `http://localhost:5190/editor`.

Expected:
1. The stage shows the **agent-authored** composition (portrait 9:16), and the timeline shows its sequences. The library lists ONLY the project's compositions — not the ~48 demos.
2. Scrub the timeline, then ask the chat "what frame am I on?" → the agent calls `getTimeline` (rendered as a collapsible `<Tool>` card) and reports that frame. **This is the first live browser confirmation of the end-of-Phase-1 `?c=` / `syncSelected` fix**, which was never verified because the browser check was blocked on a disconnected extension.
3. Press play — the fade-in, the two centered headline lines, and the fade-out to black.

- [ ] **Step 7: Confirm the two registries stayed separate**

Load `http://localhost:5190/` — the demo studio still lists all ~48 demo compositions, unchanged, and `/c/basic` still renders. The agent's work is invisible here, and the demos are invisible in `/editor`. **That separation is the headline fix of this phase.**

---

## Self-review notes

- **Spec coverage:** `ProjectFs` (A1–A4) · write tools each also a plain function (B2, B3, B5, proven by E2) · smoove-video in the system prompt (B6) · Vitest (A3, B4) · the editor's own list, separate from the demo registry (B1, C2, C3, C5, proven by E3 steps 3 and 7) · the Phase-1 `getTimeline`/`?c=` fix verified in a browser (E3 step 6).
- **The #1 Phase 1 problem is fixed structurally, not cosmetically.** `registry` is *deleted* from `setupAi` and `EditorToolContext` rather than merely pointed elsewhere, so the demo catalog cannot leak back into the editor by accident. `ai.server.ts` no longer imports `registry.ts` at all.
- **Why the agent reads disk and the browser reads a glob** is the one design decision that everything else hangs off. An in-memory registry is captured at construction (`defineRegistry`) and memoized (`getAi`), so a composition scaffolded at step 1 of a turn would be invisible to `listCompositions` at step 2 of the same turn. Reading disk per call is what makes the author→verify loop possible at all.
- **Type consistency:** `CompositionMeta`, `ScaffoldSpec`, `ScaffoldResult`, `TypecheckDiagnostic`, `TypecheckResult` are defined once in `project/types.ts` and used verbatim everywhere. `EditorToolContext` is `{ project, context? }` in every task. Phase 1's `CompositionSummary` is deliberately **removed** (B1) — it described registry entries that no longer feed the editor.
- **Path jailing is tested, not asserted** (A3): `../escape.ts`, `a/../../escape.ts`, `/etc/passwd`, and `""` all have to throw. An LLM will emit one of these eventually.
- **Three facts were probed, not guessed:** tsc resolves `@smoove/core` from the scratch dir with no `paths` mapping (exit 0); `--pretty false` diagnostics parse with a single regex and tsc exits **2**; `execFile` rejects on that nonzero exit, so the diagnostics must be read off the rejected error's `stdout` — the single most likely thing to get silently wrong in `typecheck`.
- **Known, accepted wrinkle:** a newly scaffolded composition reaches the browser via a Vite glob reload, which is a full page reload and drops in-memory chat history. Called out in C2 rather than hidden. Conversation persistence is a later phase.
- **Out of scope, deliberately:** server render of project compositions (`/api/render` resolves demo ids only — C5 drops the `render` prop so it degrades rather than failing at the click), `templates/editor`, selection/props references, export.

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
    if (count === 0) {
      throw new Error(`String not found in ${relPath}: ${JSON.stringify(oldString)}`);
    }
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
    const args = [
      tsc,
      "--noEmit",
      "--pretty",
      "false",
      "-p",
      path.join(this.root, "tsconfig.json"),
    ];

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

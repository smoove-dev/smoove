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

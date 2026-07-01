import { createHash } from "node:crypto";
import { build as esbuildBuild, type Plugin as EsbuildPlugin } from "esbuild";
import { type Plugin, type ResolvedConfig, transformWithEsbuild } from "vite";

/**
 * @smoove/vite — makes the studio feel like a framework under Vite.
 *
 * It wires HMR for you. A registry module is authored as
 * `export default defineRegistry([pulse, ribbon, …])`, where each identifier is
 * the default export of a demo directory (`./compositions/pulse` →
 * `index.ts` default-exporting a `RegistryEntry`). The plugin rewrites the
 * default export into a named binding and appends the `import.meta.hot.accept`
 * block that re-registers an entry's composition on source edits — so you never
 * write `import.meta.hot`.
 *
 * Editing a demo's `composition.ts` propagates up through its `index.ts` to the
 * registry boundary; the handler calls `registry.update(entry.id,
 * entry.composition)`, and the studio rebuilds + remounts in place (preserving
 * selection, props and playhead).
 *
 * Without the plugin everything still works — you just wire HMR by hand.
 *
 * It also fixes assets for server rendering: a composition imports media and
 * fonts as Vite URLs (`import clip from "./clip.mp4"`, `import face from
 * "./font.woff2?url"`), which the browser player/`FontFace` can use but the
 * headless renderer's ffmpeg/skia can't open. In the SSR build the plugin
 * rewrites those imports to an absolute FILESYSTEM path; the client build is
 * untouched. So `new Video({ src: clip })` and `new Font({ faces: [{ src: face }]
 * })` just work in both — no per-`src` helper to remember. (The `?url` query is
 * stripped before matching, so both bare and `?url` imports are handled.)
 *
 * It also serves compositions as standalone player modules via the `?comp-url`
 * import query. A demo authored as `src/demos/orbit.ts` (default-exporting a
 * `Composition`) is loaded into `<smoove-player src=…>` by importing
 * `"./orbit.ts?comp-url"` — the default export is the served URL of a *compiled,
 * self-contained* ESM module the browser can `import()` at runtime.
 *
 * Plain `?url` can't do this: it copies the raw `.ts` source verbatim to
 * `/assets/orbit-HASH.ts`, which the server labels `video/mp2t` (the MPEG
 * transport-stream extension) so the browser refuses it as a module — and even
 * with the right MIME it's untranspiled TS with bare `@smoove/core` imports.
 * `?comp-url` esbuild-bundles the demo instead (pulling in `@smoove/transitions`,
 * fonts, media and helpers) and emits real `.js`. `@smoove/core` and `konva`
 * stay *external*, rewritten to `window.Smoove` / `window.Konva` — the globals
 * the standalone player pins — so the composition shares the player's single
 * core/konva instance rather than instantiating a second copy. In dev the query
 * delegates to Vite's `?url` (the dev server already transpiles `.ts` on
 * request), so only the production build changes.
 */
export interface SmooveOptions {
  /** Which modules are treated as registry files. Default: `*registry.{ts,tsx,js,jsx}`. */
  include?: RegExp;
  /**
   * Asset imports matching this extension set resolve to an absolute filesystem
   * path in the SSR build (instead of a Vite URL), so the server renderer can
   * read them. The client build is unaffected. Pass a custom RegExp to widen or
   * narrow the set; default covers common video, audio, image, and font
   * extensions. The `?url` query (used by font imports) is stripped before the
   * test, so `./font.woff2?url` matches.
   */
  serverAssets?: RegExp;
}

const DEFAULT_SERVER_ASSETS =
  /\.(?:mp4|webm|mov|m4v|mkv|mp3|wav|ogg|m4a|aac|flac|png|jpe?g|webp|avif|gif|woff2?|ttf|otf)$/i;

// biome-ignore lint/suspicious/noExplicitAny: ESTree nodes are walked structurally.
type AnyNode = any;

export function smoove(options: SmooveOptions = {}): Plugin {
  const include = options.include ?? /registry\.(?:t|j)sx?$/;
  const serverAssets = options.serverAssets ?? DEFAULT_SERVER_ASSETS;

  let isBuild = false;
  let base = "/";
  let assetsDir = "assets";

  return {
    name: "smoove",
    enforce: "pre",
    configResolved(config: ResolvedConfig) {
      isBuild = config.command === "build";
      base = config.base;
      assetsDir = config.build.assetsDir;
    },
    async load(id, loadOptions) {
      // `X.ts?comp-url` → the served URL of a compiled standalone player module.
      if (queryFlags(id).includes("comp-url")) {
        const compFile = id.split("?")[0] ?? id;
        if (!isBuild) {
          // Dev: the dev server already transpiles `.ts` and resolves bare
          // imports against the shared graph, so hand off to Vite's `?url`.
          return `export { default } from ${JSON.stringify(`${compFile}?url`)};`;
        }
        // A framework build (e.g. React Router) runs separate client and SSR
        // passes. Resolve to a stable public URL both agree on — deriving the
        // filename from a content hash we compute ourselves (not Rollup's
        // `import.meta.ROLLUP_FILE_URL`, which points at a `file://` path in the
        // server build) — and only *emit* the file from the client pass.
        const source = await compileComposition(compFile);
        const fileName = `${assetsDir}/${baseName(compFile)}-${contentHash(source)}.js`;
        const envName = (this as { environment?: { name?: string } }).environment?.name;
        const isSsr = loadOptions?.ssr === true || (envName != null && envName !== "client");
        if (!isSsr) this.emitFile({ type: "asset", fileName, source });
        return `export default ${JSON.stringify(base + fileName)};`;
      }

      const file = id.split("?")[0] ?? id;
      if (!serverAssets.test(file)) return null;
      // Only the server (SSR) sees a filesystem path — the client keeps the URL.
      // Support both the Environment API (Vite 6) and the legacy `ssr` flag.
      const envName = (this as { environment?: { name?: string } }).environment?.name;
      const ssr = loadOptions?.ssr === true || (envName != null && envName !== "client");
      if (!ssr) return null;
      return `export default ${JSON.stringify(file)};`;
    },
    async transform(code, id) {
      const file = id.split("?")[0] ?? id;
      if (!include.test(file)) return null;
      if (!code.includes("defineRegistry")) return null;

      // Parse a type-stripped copy (acorn can't read TS); edits apply to `code`.
      let program: AnyNode;
      try {
        const js = await toJs(code, file);
        program = this.parse(js);
      } catch {
        return null;
      }

      // Only act on a module whose default export is `defineRegistry([...])`.
      // (Gating on the call — not the filename — keeps us off the studio's own
      // `define-registry.js`, which also ends in "registry".)
      const array = registryArray(program);
      if (!array) return null;

      const specs = entrySpecs(array, defaultImports(program));
      return { code: buildOutput(code, specs), map: null };
    },
  };
}

/** Alias under the name the framework is marketed with. */
export const reactMotionStudio = smoove;
export default smoove;

// ---------------------------------------------------------------- internals

/** The `&`-separated flags of an id's query string (`a.ts?x&y` → `["x", "y"]`). */
function queryFlags(id: string): string[] {
  const q = id.split("?")[1];
  return q ? q.split("&") : [];
}

/** Short content hash for a deterministic, cache-busting asset filename. */
function contentHash(source: string): string {
  return createHash("sha256").update(source).digest("hex").slice(0, 8);
}

/** `/abs/demos/orbit.ts` → `orbit`. */
function baseName(file: string): string {
  const stem = file.slice(file.lastIndexOf("/") + 1);
  const dot = stem.lastIndexOf(".");
  return dot > 0 ? stem.slice(0, dot) : stem;
}

/** Media/font/image extensions esbuild inlines as data URLs so the compiled
    composition module is self-contained (no sibling asset requests to wire up). */
const COMP_DATAURL_LOADERS = {
  ".mp4": "dataurl",
  ".webm": "dataurl",
  ".mov": "dataurl",
  ".m4v": "dataurl",
  ".mkv": "dataurl",
  ".mp3": "dataurl",
  ".wav": "dataurl",
  ".ogg": "dataurl",
  ".m4a": "dataurl",
  ".aac": "dataurl",
  ".flac": "dataurl",
  ".png": "dataurl",
  ".jpg": "dataurl",
  ".jpeg": "dataurl",
  ".webp": "dataurl",
  ".avif": "dataurl",
  ".gif": "dataurl",
  ".svg": "dataurl",
  ".woff2": "dataurl",
  ".woff": "dataurl",
  ".ttf": "dataurl",
  ".otf": "dataurl",
} as const;

/**
 * Rewrites `@smoove/core` and `konva` to the globals the standalone player pins
 * (`window.Smoove` / `window.Konva`), keeping them out of the bundle so the
 * composition shares the player's single core/konva instance. A CommonJS body
 * (`module.exports = window.…`) lets esbuild's interop satisfy default, named
 * and namespace imports alike.
 */
const smooveGlobals: EsbuildPlugin = {
  name: "smoove-window-globals",
  setup(build) {
    build.onResolve({ filter: /^(?:@smoove\/core|konva)$/ }, (a) => ({
      path: a.path,
      namespace: "smoove-global",
    }));
    build.onLoad({ filter: /.*/, namespace: "smoove-global" }, (a) => ({
      contents: `module.exports = window.${a.path === "konva" ? "Konva" : "Smoove"};`,
      loader: "js",
    }));
  },
};

/** esbuild-bundle a demo into a self-contained ESM module (see `?comp-url`). */
async function compileComposition(file: string): Promise<string> {
  const result = await esbuildBuild({
    entryPoints: [file],
    bundle: true,
    format: "esm",
    target: "es2022",
    platform: "browser",
    write: false,
    logLevel: "silent",
    loader: COMP_DATAURL_LOADERS,
    plugins: [smooveGlobals],
  });
  const out = result.outputFiles?.[0]?.text;
  if (out == null) throw new Error(`[smoove] ?comp-url produced no output for ${file}`);
  return out;
}

async function toJs(code: string, filename: string): Promise<string> {
  const loader = /\.(?:tsx|jsx)$/.test(filename) ? "tsx" : "ts";
  // jsx: "transform" → React.createElement calls, which acorn can parse (we only
  // parse, never run this output), so JSX in a registry won't choke the parser.
  const out = await transformWithEsbuild(code, filename, {
    loader,
    jsx: "transform",
    sourcemap: false,
  });
  return out.code;
}

/** The array literal of a module whose default export is `defineRegistry([...])`,
    or null if this module isn't a registry. */
function registryArray(program: AnyNode): AnyNode | null {
  for (const stmt of program.body ?? []) {
    if (stmt.type !== "ExportDefaultDeclaration") continue;
    const d = stmt.declaration;
    if (
      d?.type === "CallExpression" &&
      d.callee?.type === "Identifier" &&
      d.callee.name === "defineRegistry" &&
      d.arguments?.[0]?.type === "ArrayExpression"
    ) {
      return d.arguments[0];
    }
  }
  return null;
}

/** Map of default-import local name → import source. */
function defaultImports(program: AnyNode): Map<string, string> {
  const imports = new Map<string, string>();
  for (const stmt of program.body ?? []) {
    if (stmt.type !== "ImportDeclaration") continue;
    const src = stmt.source?.value;
    if (typeof src !== "string") continue;
    for (const spec of stmt.specifiers ?? []) {
      if (spec.type === "ImportDefaultSpecifier" && spec.local?.name) {
        imports.set(spec.local.name, src);
      }
    }
  }
  return imports;
}

/**
 * The import specifiers of the entries in `defineRegistry([...])`. Each array
 * element is expected to be a default-imported identifier (a demo's `index.ts`);
 * its import source is what we wire HMR against.
 */
function entrySpecs(array: AnyNode, imports: Map<string, string>): string[] {
  const specs: string[] = [];
  for (const el of array.elements ?? []) {
    if (el?.type === "Identifier" && imports.has(el.name)) {
      const src = imports.get(el.name);
      if (src && !specs.includes(src)) specs.push(src);
    }
  }
  return specs;
}

function buildOutput(code: string, specs: string[]): string {
  const REG = "__km_registry";
  // Name the default export so the appended code can reference it.
  const named = code.replace(/export\s+default\s+/, `const ${REG} = `);

  const lines = [named, "", "/* @smoove/vite — injected HMR */", `export default ${REG};`];

  if (specs.length > 0) {
    lines.push(
      "if (import.meta.hot) {",
      `  import.meta.hot.accept(${JSON.stringify(specs)}, (__mods) => {`,
      "    for (const __m of __mods) {",
      "      const __e = __m && __m.default;",
      `      if (__e && __e.id) ${REG}.update(__e.id, __e.composition);`,
      "    }",
      "  });",
      "}",
    );
  }

  return lines.join("\n");
}

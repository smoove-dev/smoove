import { type Plugin, transformWithEsbuild } from "vite";

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

  return {
    name: "smoove",
    enforce: "pre",
    load(id, loadOptions) {
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

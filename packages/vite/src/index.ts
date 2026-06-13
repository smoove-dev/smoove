import { type Plugin, transformWithEsbuild } from "vite";

/**
 * @konva-motion/vite — makes the studio feel like a framework under Vite.
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
 */
export interface KonvaMotionOptions {
  /** Which modules are treated as registry files. Default: `*registry.{ts,tsx,js,jsx}`. */
  include?: RegExp;
}

// biome-ignore lint/suspicious/noExplicitAny: ESTree nodes are walked structurally.
type AnyNode = any;

export function konvaMotion(options: KonvaMotionOptions = {}): Plugin {
  const include = options.include ?? /registry\.(?:t|j)sx?$/;

  return {
    name: "konva-motion",
    enforce: "pre",
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
export const reactMotionStudio = konvaMotion;
export default konvaMotion;

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

  const lines = [named, "", "/* @konva-motion/vite — injected HMR */", `export default ${REG};`];

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

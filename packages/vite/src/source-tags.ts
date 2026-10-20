import { isAbsolute, relative } from "node:path";
import { parse } from "@babel/parser";
import MagicString, { type SourceMap } from "magic-string";

/** The module transformed files import the tagging helper from. */
export const SOURCE_MODULE = "virtual:smoove-source";

/**
 * The helper: remembers where a Konva node was created, as a plain property
 * (never an attribute, so it can't reach `toJSON()` or an updater), and
 * returns whatever it was given. Anything that isn't a node passes through.
 */
export const SOURCE_MODULE_CODE = `export function __smooveSrc(value, file, line, column) {
  if (value && typeof value.getClassName === "function") {
    value._smooveSource = { file, line, column };
  }
  return value;
}
`;

const SCRIPT = /\.(?:[cm]?[jt]sx?)$/;
const SMOOVE_IMPORT = /\bfrom\s*["'](?:@smoove\/[^"']*|konva(?:\/[^"']*)?)["']/;

type Node = { type: string; start?: number | null; end?: number | null; [key: string]: unknown };

/**
 * Tag every `new` expression in a project file that imports smoove or Konva,
 * so the node it builds knows its file, line and column (1-based, in the
 * original source). Wrapping every `new` rather than only imported classes
 * also catches the author's own subclasses (`class Card extends Block`); the
 * helper keeps only Konva nodes. Null when the file needs nothing or doesn't
 * parse. Development only: the plugin never runs it in a build.
 */
export function tagSources(
  code: string,
  id: string,
  root: string,
): { code: string; map: SourceMap } | null {
  const file = id.split("?")[0] ?? id;
  if (!SCRIPT.test(file) || file.includes("/node_modules/") || file.startsWith("\0")) return null;
  if (!SMOOVE_IMPORT.test(code)) return null;
  // Project files only: a linked workspace package resolves outside node_modules.
  const rel = relative(root, file).split("\\").join("/");
  if (rel.startsWith("../") || rel === ".." || isAbsolute(rel)) return null;

  const jsx = /x$/.test(file) || /\.[cm]?js$/.test(file);
  const ts = /\.[cm]?tsx?$/.test(file);
  let program: Node;
  try {
    program = parse(code, {
      sourceType: "module",
      plugins: [...(ts ? (["typescript"] as const) : []), ...(jsx ? (["jsx"] as const) : [])],
    }).program as unknown as Node;
  } catch {
    return null;
  }

  const news: Array<{ start: number; end: number; line: number; column: number }> = [];
  walk(program, (node) => {
    if (node.type !== "NewExpression" || node.start == null || node.end == null) return;
    const loc = node.loc as { start: { line: number; column: number } } | undefined;
    if (!loc) return;
    news.push({
      start: node.start,
      end: node.end,
      line: loc.start.line,
      column: loc.start.column + 1,
    });
  });
  if (news.length === 0) return null;

  const where = JSON.stringify(rel);
  const s = new MagicString(code);
  for (const n of news) {
    s.prependLeft(n.start, "__smooveSrc(");
    s.appendRight(n.end, `, ${where}, ${n.line}, ${n.column})`);
  }
  // Same line as the original first line, so line numbers stay put.
  s.prepend(`import { __smooveSrc } from "${SOURCE_MODULE}";`);
  return { code: s.toString(), map: s.generateMap({ hires: true, source: file }) };
}

/** Visit every AST node under `node`. */
function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === "loc" || key === "leadingComments" || key === "trailingComments") continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const v of value) if (isNode(v)) walk(v, visit);
    } else if (isNode(value)) {
      walk(value, visit);
    }
  }
}

function isNode(v: unknown): v is Node {
  return typeof v === "object" && v !== null && typeof (v as Node).type === "string";
}

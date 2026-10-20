import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { type ParserPlugin, parse } from "@babel/parser";

/** One purity lint finding. Lines and columns are 1-based. */
export interface LintFinding {
  code: "purity/math-random" | "purity/clock" | "purity/random-in-updater" | "lint/parse-error";
  message: string;
  source: { file: string; line: number; column: number; inherited: false };
}

const MESSAGES: Record<LintFinding["code"], string> = {
  "purity/math-random":
    "Math.random() changes between page loads and renders. Use random(seed) at module scope.",
  "purity/clock":
    "The clock and timers aren't the frame, so scrubbing and rendering can't reproduce them. Drive the value from the frame.",
  "purity/random-in-updater":
    "This generator is advanced inside an updater, so a seek hands out different numbers than playback. Read its values into an array once, at module scope.",
  "lint/parse-error": "This file doesn't parse, so the lint skipped it.",
};

const SKIP_DIRS = new Set(["node_modules", "dist", "out", "build"]);
const EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs"]);
const SKIP_FILE = /\.(test|spec|check)\.[cm]?[jt]sx?$|\.d\.ts$/;
const IMPORTS_SMOOVE = /from\s+["'](@smoove\/|konva["'/])|import\s+["'](@smoove\/|konva["'/])/;
const GENERATOR_METHODS = new Set(["range", "int", "pick"]);
const TIMERS = new Set(["requestAnimationFrame", "setTimeout", "setInterval"]);

// biome-ignore lint/suspicious/noExplicitAny: a Babel AST walked generically.
type Node = any;

const isFunction = (n: Node): boolean =>
  n?.type === "ArrowFunctionExpression" || n?.type === "FunctionExpression";

const member = (n: Node, object: string, property: string): boolean =>
  n?.type === "MemberExpression" &&
  n.object?.type === "Identifier" &&
  n.object.name === object &&
  !n.computed &&
  n.property?.name === property;

/** Every identifier a function declares: its params and its variables. */
function declaredIn(fn: Node): Set<string> {
  const names = new Set<string>();
  const addPattern = (p: Node): void => {
    if (!p) return;
    if (p.type === "Identifier") names.add(p.name);
    else if (p.type === "AssignmentPattern") addPattern(p.left);
    else if (p.type === "RestElement") addPattern(p.argument);
    else if (p.type === "ArrayPattern") for (const e of p.elements) addPattern(e);
    else if (p.type === "ObjectPattern")
      for (const e of p.properties) addPattern(e.value ?? e.argument);
  };
  for (const p of fn.params ?? []) addPattern(p);
  walk(fn.body, (n) => {
    if (n.type === "VariableDeclarator") addPattern(n.id);
  });
  return names;
}

function walk(node: Node, visit: (n: Node, parents: Node[]) => void, parents: Node[] = []): void {
  if (!node || typeof node.type !== "string") return;
  visit(node, parents);
  const next = [...parents, node];
  for (const key of Object.keys(node)) {
    if (
      key === "loc" ||
      key === "start" ||
      key === "end" ||
      key.startsWith("leading") ||
      key.startsWith("trailing")
    )
      continue;
    const value = node[key];
    if (Array.isArray(value)) for (const v of value) walk(v, visit, next);
    else if (value && typeof value === "object") walk(value, visit, next);
  }
}

function pluginsFor(file: string): ParserPlugin[] {
  const ext = extname(file);
  if (ext === ".tsx") return ["typescript", "jsx"];
  if (ext === ".ts" || ext === ".mts") return ["typescript"];
  return ["jsx"];
}

/** Lint one file's source. `file` is the path to report, relative to the project. */
export function lintSource(code: string, file: string): LintFinding[] {
  const at = (n: Node): LintFinding["source"] => ({
    file,
    line: n.loc.start.line,
    column: n.loc.start.column + 1,
    inherited: false,
  });
  const finding = (code: LintFinding["code"], n: Node): LintFinding => ({
    code,
    message: MESSAGES[code],
    source: at(n),
  });

  let ast: Node;
  try {
    ast = parse(code, { sourceType: "module", plugins: pluginsFor(file), errorRecovery: false });
  } catch (err) {
    const loc = (err as { loc?: { line: number; column: number } }).loc;
    return [
      {
        code: "lint/parse-error",
        message: MESSAGES["lint/parse-error"],
        source: { file, line: loc?.line ?? 1, column: (loc?.column ?? 0) + 1, inherited: false },
      },
    ];
  }

  // The local name `random` is imported as, if it's imported at all.
  const randomNames = new Set<string>();
  for (const stmt of ast.program.body) {
    if (stmt.type !== "ImportDeclaration" || !String(stmt.source.value).startsWith("@smoove/"))
      continue;
    for (const s of stmt.specifiers) {
      if (s.type === "ImportSpecifier" && (s.imported?.name ?? s.imported?.value) === "random") {
        randomNames.add(s.local.name);
      }
    }
  }

  // Generators made outside any updater: `const r = random(seed)`.
  const updaters = new Set<Node>();
  walk(ast.program, (n) => {
    if (
      n.type === "CallExpression" &&
      n.callee?.type === "MemberExpression" &&
      n.callee.property?.name === "register"
    ) {
      for (const arg of n.arguments) if (isFunction(arg)) updaters.add(arg);
    }
  });
  const generators = new Set<string>();
  walk(ast.program, (n, parents) => {
    if (
      n.type === "VariableDeclarator" &&
      n.id?.type === "Identifier" &&
      n.init?.type === "CallExpression" &&
      n.init.callee?.type === "Identifier" &&
      randomNames.has(n.init.callee.name) &&
      !parents.some((p) => updaters.has(p))
    ) {
      generators.add(n.id.name);
    }
  });

  const out: LintFinding[] = [];
  walk(ast.program, (n, parents) => {
    if (n.type === "CallExpression") {
      const c = n.callee;
      if (member(c, "Math", "random")) out.push(finding("purity/math-random", n));
      else if (member(c, "Date", "now") || member(c, "performance", "now"))
        out.push(finding("purity/clock", n));
      else if (c?.type === "Identifier" && TIMERS.has(c.name)) out.push(finding("purity/clock", n));
      else if (
        c?.type === "MemberExpression" &&
        c.object?.type === "Identifier" &&
        ["window", "globalThis"].includes(c.object.name) &&
        TIMERS.has(c.property?.name)
      ) {
        out.push(finding("purity/clock", n));
      }

      // A generator call inside an updater that doesn't declare its own.
      const name =
        c?.type === "Identifier"
          ? c.name
          : c?.type === "MemberExpression" &&
              c.object?.type === "Identifier" &&
              GENERATOR_METHODS.has(c.property?.name)
            ? c.object.name
            : null;
      if (name && generators.has(name)) {
        const inside = parents.filter((p) => updaters.has(p));
        if (inside.length > 0 && !inside.some((u) => declaredIn(u).has(name))) {
          out.push(finding("purity/random-in-updater", n));
        }
      }
    } else if (n.type === "NewExpression") {
      const c = n.callee;
      if (c?.type === "Identifier" && c.name === "Date" && n.arguments.length === 0)
        out.push(finding("purity/clock", n));
      else if (member(c, "Konva", "Tween") || member(c, "Konva", "Animation"))
        out.push(finding("purity/clock", n));
    }
  });
  return out.sort((a, b) => a.source.line - b.source.line || a.source.column - b.source.column);
}

function* projectFiles(root: string, dir: string = root): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* projectFiles(root, path);
    } else if (EXTENSIONS.has(extname(entry.name)) && !SKIP_FILE.test(entry.name)) {
      yield path;
    }
  }
}

/** Lint every project file under `root` that imports from a `@smoove/` package or from `konva`. */
export function lintProject(root: string): LintFinding[] {
  const out: LintFinding[] = [];
  const files = [...projectFiles(root)].sort();
  for (const path of files) {
    const code = readFileSync(path, "utf8");
    if (!IMPORTS_SMOOVE.test(code)) continue;
    out.push(...lintSource(code, relative(root, path).split(sep).join("/")));
  }
  return out;
}

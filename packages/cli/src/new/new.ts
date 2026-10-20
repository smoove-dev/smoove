/**
 * `smoove new`: a ready composition folder under `compositions/`, a title card
 * to start from. The command line asks for what its flags leave out; MCP and
 * scripts pass everything as input.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type CommandResult, type RunContext, UsageError } from "../commands.js";
import { findProject, liveServer } from "../project.js";
import { done, fail } from "../run.js";
import { KEBAB, kebab } from "./ids.js";
import { checkTs, compositionTs, indexTs, type NewFiles, schemaTs, testTs } from "./templates.js";

export const FORMATS = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
} as const;

export type Format = keyof typeof FORMATS;

export interface NewInput {
  title: string;
  id?: string;
  group?: string;
  description?: string;
  format?: Format;
  seconds?: number;
}

export const DEFAULT_GROUP = "Compositions";
export const DEFAULT_SECONDS = 5;
export { KEBAB, kebab };

const ID = /\bid:\s*["']([^"']+)["']/;
const GROUP = /\bgroup:\s*["']([^"']+)["']/;

/** The index file of each folder under `compositions/`, by folder name. */
function indexFiles(root: string): { folder: string; source: string }[] {
  const dir = join(root, "compositions");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .flatMap((d) => {
      const file = ["index.ts", "index.js"]
        .map((f) => join(dir, d.name, f))
        .find((f) => existsSync(f));
      return file ? [{ folder: d.name, source: readFileSync(file, "utf8") }] : [];
    });
}

/** The groups the project's compositions use, each once, in folder order. */
export function existingGroups(root: string): string[] {
  const groups: string[] = [];
  for (const { source } of indexFiles(root)) {
    const group = GROUP.exec(source)?.[1];
    if (group && !groups.includes(group)) groups.push(group);
  }
  return groups;
}

/** Write `compositions/<id>/`. Refuses a folder or an id that's already taken. */
export function createComposition(root: string, input: NewInput): { dir: string; files: string[] } {
  const id = input.id ?? kebab(input.title);
  if (!id)
    throw new UsageError(`"${input.title}" makes no id. Give one with --id, like --id intro.`);
  if (!KEBAB.test(id)) {
    throw new UsageError(`The id "${id}" must be kebab case: lowercase words joined by dashes.`);
  }
  const compositions = join(root, "compositions");
  const dir = join(compositions, id);
  if (existsSync(compositions)) {
    const clash = readdirSync(compositions).find((name) => name.toLowerCase() === id);
    if (clash) throw new UsageError(`compositions/${clash} is already there. Pick another id.`);
  }
  const taken = indexFiles(root).find(({ source }) => ID.exec(source)?.[1] === id);
  if (taken) {
    throw new UsageError(
      `compositions/${taken.folder} already uses the id "${id}". Pick another id.`,
    );
  }

  const { width, height } = FORMATS[input.format ?? "landscape"];
  const f: NewFiles = {
    id,
    title: input.title,
    group: input.group ?? DEFAULT_GROUP,
    description: input.description ?? "",
    width,
    height,
    fps: 30,
    seconds: input.seconds ?? DEFAULT_SECONDS,
  };
  const files: Record<string, string> = {
    "index.ts": indexTs(f),
    "schema.ts": schemaTs(f),
    "composition.ts": compositionTs(f),
    "composition.check.ts": checkTs(f),
    "composition.test.ts": testTs(f),
  };
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return { dir, files: Object.keys(files) };
}

/** The `new` command: create the folder, and say where it is and where to watch it. */
export async function runNew(ctx: RunContext, input: NewInput): Promise<CommandResult> {
  const root = findProject(ctx.cwd);
  if (!root) return fail("no-project", "There's no smoove project here or above.");
  const { dir, files } = createComposition(root, input);
  const id = dir.slice(dir.lastIndexOf("/") + 1);
  const lines = [`Created compositions/${id}/ with ${files.join(", ")}.`];
  const server = liveServer(root);
  if (server) lines.push(`It's in the studio: ${server.url}c/${id}`);
  else if (ctx.door === "mcp") lines.push("Call the start tool to see it in the studio.");
  else lines.push("Start the studio with `npx smoove start` to see it.");
  return done({ id, dir, files, url: server ? `${server.url}c/${id}` : null }, lines);
}

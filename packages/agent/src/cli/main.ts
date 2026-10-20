import { parseArgs } from "node:util";
import {
  COMMANDS,
  type CommandResult,
  commandNamed,
  type RunContext,
  UsageError,
} from "./commands.js";

export { formatCheck, formatContext, formatStatus, formatTimeline } from "./format.js";

/** Where a command writes, and the folder it runs in. Swappable for tests. */
export interface Io {
  cwd: string;
  out(text: string): void;
  err(text: string): void;
  /** Wait between polls. */
  sleep(ms: number): Promise<void>;
  env: NodeJS.ProcessEnv;
}

export const defaultIo: Io = {
  cwd: process.cwd(),
  out: (t) => process.stdout.write(`${t}\n`),
  err: (t) => process.stderr.write(`${t}\n`),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  env: process.env,
};

/** What follows a command's name in the usage text. */
const ARGS: Record<string, string> = {
  start: "[--port <n>]",
  seek: "<frame>",
  render_status: "<job>",
};

const USAGE = [
  "smoove: see and render the smoove studio from a shell.",
  "",
  "Run it from inside the project. Every command takes --json for the raw answer.",
  "",
  ...COMMANDS.map((c) => `  ${`smoove ${c.name} ${ARGS[c.name] ?? ""}`.padEnd(32)}${c.summary}`),
  `  ${"smoove mcp".padEnd(32)}Serve these commands as MCP tools over standard input and output`,
  "",
  "Options:",
  "  --comp <id>        The composition (default: the one the user is watching)",
  "  --frame <n>        A frame, counting from 0",
  '  --at <beat>        A beat: "hook" (its sheet frame), or hook.start, hook.settled,',
  "                     hook.last or hook.end",
  "  --width <px>       Image width (snap default 640; sheet tile default 320)",
  "  --frames <n>       Sheet: n evenly spaced frames instead of one per beat (2 to 24)",
  "  --format <f>       Render: mp4 (default) or webm",
  "  --from <n> --to <n>  Render: a frame range, both inclusive",
  "  --out <path>       Render: where the file goes (default out/<comp>.<format>)",
  "  --no-wait          Render: return once the job is queued",
  "  --all              Check: every composition in the catalog",
  "  --only <groups>    Check: some of purity, layout, intent, motion, style (comma-separated)",
  "  --images           Check: write an image for each error and held warning",
  "  --json             Print the bridge's JSON answer",
].join("\n");

export type Values = {
  json?: boolean;
  help?: boolean;
  comp?: string;
  frame?: string;
  at?: string;
  width?: string;
  frames?: string;
  format?: string;
  from?: string;
  to?: string;
  out?: string;
  port?: string;
  "no-wait"?: boolean;
  all?: boolean;
  only?: string;
  images?: boolean;
};

const CHECK_GROUPS = ["purity", "layout", "intent", "motion", "style"];

function int(name: string, value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new UsageError(`--${name} must be a whole number.`);
  return n;
}

/** Copy the defined fields only. */
function defined(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
}

/** A command's input from the command line's flags and positional arguments. */
export function argsToInput(
  command: string,
  values: Values,
  positionals: string[],
): Record<string, unknown> {
  const composition = values.comp;
  switch (command) {
    case "start":
      return defined({ port: int("port", values.port) });
    case "seek":
      return defined({
        frame: int("frame", positionals[0] ?? values.frame),
        at: values.at,
        composition,
      });
    case "snap":
      return defined({
        composition,
        frame: int("frame", values.frame),
        at: values.at,
        width: int("width", values.width),
      });
    case "sheet":
      return defined({
        composition,
        frames: int("frames", values.frames),
        width: int("width", values.width),
      });
    case "timeline":
      return defined({ composition });
    case "render_status":
      return defined({ job: positionals[0] });
    case "check": {
      let groups: string[] | undefined;
      if (values.only !== undefined) {
        groups = values.only
          .split(",")
          .map((g) => g.trim())
          .filter(Boolean);
        const bad = groups.find((g) => !CHECK_GROUPS.includes(g));
        if (bad || groups.length === 0) {
          throw new UsageError(
            `--only takes some of ${CHECK_GROUPS.join(", ")}, not "${bad ?? values.only}".`,
          );
        }
      }
      return defined({ composition, all: values.all, groups, images: values.images });
    }
    case "render": {
      const from = int("from", values.from);
      const to = int("to", values.to);
      if ((from === undefined) !== (to === undefined)) {
        throw new UsageError("Give both --from and --to, or neither.");
      }
      if (values.format && values.format !== "mp4" && values.format !== "webm") {
        throw new UsageError("--format must be mp4 or webm.");
      }
      return defined({
        composition,
        format: values.format,
        from,
        to,
        out: values.out,
        wait: values["no-wait"] ? false : undefined,
      });
    }
    default:
      return {};
  }
}

/** Print a result the way the command line always has. Returns the exit code. */
export function printResult(io: Io, json: boolean, result: CommandResult): number {
  if (json) {
    io.out(JSON.stringify(result.answer));
    return result.code;
  }
  if (result.text) io.out(result.text);
  if (result.errors) io.err(result.errors);
  return result.code;
}

/** Run one command. Resolves to the exit code: 0 ok, 1 failed, 2 bad usage. */
export async function main(argv: string[], io: Io = defaultIo): Promise<number> {
  let values: Values;
  let positionals: string[];
  try {
    const parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        json: { type: "boolean" },
        help: { type: "boolean", short: "h" },
        comp: { type: "string" },
        frame: { type: "string" },
        at: { type: "string" },
        width: { type: "string" },
        frames: { type: "string" },
        format: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
        out: { type: "string" },
        port: { type: "string" },
        "no-wait": { type: "boolean" },
        all: { type: "boolean" },
        only: { type: "string" },
        images: { type: "boolean" },
      },
    });
    values = parsed.values as Values;
    positionals = parsed.positionals;
  } catch (err) {
    io.err(`${err instanceof Error ? err.message : String(err)}\n\n${USAGE}`);
    return 2;
  }

  const [name, ...rest] = positionals;
  if (!name || values.help || name === "help") {
    io.out(USAGE);
    return name || values.help ? 0 : 2;
  }

  if (name === "mcp") {
    // Loaded only here, so the plain commands don't pay for the SDK.
    const { serveStdio } = await import("../mcp/server.js");
    await serveStdio({ cwd: io.cwd, env: io.env, sleep: io.sleep });
    return 0;
  }

  const command = commandNamed(name);
  try {
    if (!command) throw new UsageError(`Unknown command "${name}".`);
    const parsed = command.input.safeParse(argsToInput(name, values, rest));
    if (!parsed.success) throw new UsageError(parsed.error.issues[0]?.message ?? "Bad input.");
    const json = values.json === true;
    const ctx: RunContext = {
      cwd: io.cwd,
      env: io.env,
      sleep: io.sleep,
      door: "cli",
      progress: json ? undefined : (u) => io.out(u.message),
    };
    return printResult(io, json, await command.run(ctx, parsed.data));
  } catch (err) {
    if (err instanceof UsageError) {
      io.err(`${err.message}\n\n${USAGE}`);
      return 2;
    }
    throw err;
  }
}

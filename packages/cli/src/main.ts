import { parseArgs } from "node:util";
import {
  COMMANDS,
  type Command,
  type CommandResult,
  commandNamed,
  type RunContext,
  UsageError,
} from "./commands.js";
import { findProject } from "./project.js";

export { formatCheck, formatContext, formatStatus, formatTimeline } from "./format.js";

/** Where a command writes, and the folder it runs in. Swappable for tests. */
export interface Io {
  cwd: string;
  /** A person at a terminal, who can answer questions. */
  interactive?: boolean;
  out(text: string): void;
  err(text: string): void;
  /** Wait between polls. */
  sleep(ms: number): Promise<void>;
  env: NodeJS.ProcessEnv;
}

export const defaultIo: Io = {
  cwd: process.cwd(),
  interactive: process.stdin.isTTY === true && process.stdout.isTTY === true,
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

/** The top-level commands the command line runs itself (not MCP tools). */
const LOCAL = ["start", "build", "test"] as const;

function line(spelling: string, summary: string): string {
  return `  ${spelling.padEnd(36)}${summary}`;
}

const USAGE = [
  "smoove: run the smoove studio and see it from a shell.",
  "",
  "Run it from inside the project. Every agent command takes --json for the raw answer.",
  "",
  line("smoove start [--port <n>]", "Run the studio (stop it with Ctrl+C)"),
  line("smoove start --prod", "Serve the studio smoove build made"),
  line("smoove build", "Build the studio for production"),
  line("smoove new [--title <t>]", "Create a composition (asks for what you leave out)"),
  ...COMMANDS.filter((c) => c.group === "top" && c.name !== "new").map((c) =>
    line(`smoove ${c.name} ${ARGS[c.name] ?? ""}`.trim(), c.summary),
  ),
  line("smoove test", "Run the compositions' tests"),
  "",
  "For coding agents:",
  ...COMMANDS.filter((c) => c.group === "agent").map((c) =>
    line(`smoove agent ${c.name} ${ARGS[c.name] ?? ""}`.trim(), c.summary),
  ),
  line("smoove agent mcp", "Serve these commands as MCP tools over standard input and output"),
  "",
  "Changing the studio itself:",
  line("smoove studio detach [--yes]", "Copy the studio app into the project to edit it (one-way)"),
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
  "  --title, --id, --group, --description, --format, --seconds",
  "                     New: the answers, for running it without questions",
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
  prod?: boolean;
  yes?: boolean;
  title?: string;
  id?: string;
  group?: string;
  description?: string;
  seconds?: string;
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
    case "new": {
      const seconds = values.seconds === undefined ? undefined : Number(values.seconds);
      if (seconds !== undefined && !(seconds > 0)) {
        throw new UsageError("--seconds must be a number above 0.");
      }
      return defined({
        title: values.title,
        id: values.id,
        group: values.group,
        description: values.description,
        format: values.format,
        seconds,
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
        prod: { type: "boolean" },
        yes: { type: "boolean" },
        title: { type: "string" },
        id: { type: "string" },
        group: { type: "string" },
        description: { type: "string" },
        seconds: { type: "string" },
      },
    });
    values = parsed.values as Values;
    positionals = parsed.positionals;
  } catch (err) {
    io.err(`${err instanceof Error ? err.message : String(err)}\n\n${USAGE}`);
    return 2;
  }

  const [first, ...rest] = positionals;
  if (!first || values.help || first === "help") {
    io.out(USAGE);
    return first || values.help ? 0 : 2;
  }

  try {
    if (first === "agent") {
      const [name, ...args] = rest;
      if (!name) throw new UsageError("smoove agent needs a command.");
      if (name === "mcp") {
        // Loaded only here, so the plain commands don't pay for the SDK.
        const { serveStdio } = await import("./mcp/server.js");
        await serveStdio({ cwd: io.cwd, env: io.env, sleep: io.sleep });
        return 0;
      }
      const command = commandNamed(name);
      if (command?.group !== "agent") throw new UsageError(`Unknown command "agent ${name}".`);
      return await runCommand(command, values, args, io);
    }
    if (first === "studio") {
      const [name] = rest;
      if (name !== "detach")
        throw new UsageError(`Unknown command "studio${name ? ` ${name}` : ""}".`);
      return await runLocal(`studio ${name}`, values, io);
    }
    if ((LOCAL as readonly string[]).includes(first)) return await runLocal(first, values, io);
    const command = commandNamed(first);
    if (command?.name === "new")
      return await runCommand(command, await askForNew(values, io), rest, io);
    if (command?.group === "top") return await runCommand(command, values, rest, io);
    if (command) {
      throw new UsageError(`"${first}" is an agent command now: smoove agent ${first}`);
    }
    throw new UsageError(`Unknown command "${first}".`);
  } catch (err) {
    if (err instanceof UsageError) {
      io.err(`${err.message}\n\n${USAGE}`);
      return 2;
    }
    throw err;
  }
}

/** Run one command from the table with the command line's flags. */
async function runCommand(
  command: Command,
  values: Values,
  positionals: string[],
  io: Io,
): Promise<number> {
  const parsed = command.input.safeParse(argsToInput(command.name, values, positionals));
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
}

/** `smoove new` without a title: ask at a terminal, or say which flags to pass. */
async function askForNew(values: Values, io: Io): Promise<Values> {
  if (values.title !== undefined) return values;
  if (!io.interactive) {
    throw new UsageError(
      "smoove new needs a title. Without a terminal to ask in, pass the answers as flags: --title, and optionally --id, --group, --description, --format (landscape, portrait or square) and --seconds.",
    );
  }
  const { promptNew } = await import("./new/prompt.js");
  const root = findProject(io.cwd);
  return { ...values, ...(await promptNew(values, root)) };
}

/** The commands the command line runs itself: the studio and its tests. */
async function runLocal(name: string, values: Values, io: Io): Promise<number> {
  if (name === "start" || name === "build" || name === "test") {
    const { runStudioCommand } = await import("./studio.js");
    return runStudioCommand(name, { prod: values.prod, port: int("port", values.port) }, io);
  }
  if (name === "studio detach") {
    const { runDetach } = await import("./studio.js");
    return runDetach({ yes: values.yes }, io);
  }
  throw new UsageError(`Unknown command "${name}".`);
}

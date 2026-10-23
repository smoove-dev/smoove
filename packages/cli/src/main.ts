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
  footage_add: "<file>",
  media_info: "<source>",
  media_audio: "<source>",
  extract_audio: "<source>",
  media_sheet: "<source>",
  media_video: "<source>",
  transcribe: "<source>",
  models: "[list | install parakeet]",
  media_status: "<job>",
  cut_plan: "--comp <id>",
  asset_search: "<words>",
  asset_add: "<address or file>",
  page_shot: "<address>",
};

/**
 * The top-level commands the command line runs itself (not MCP tools).
 * `test` is one too, but `main` hands it to Vitest before parsing flags.
 */
const LOCAL = ["start", "build"] as const;

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
  line("smoove test [vitest args]", "Run the compositions' tests"),
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
  "  --template recut --source <file>",
  "                     New: a recut of footage, played from the original file",
  "  --title, --id, --group, --description, --format, --seconds",
  "                     New: the answers, for running it without questions",
  "  --threshold <dB>   Audio: quiet is this many dB under the typical level (default 20)",
  "  --min-quiet <s>    Audio: shortest quiet stretch, in seconds (default 0.5)",
  "  --peaks <n>        Audio: how many loud moments to list (default 10)",
  "  --tiles <n>        Footage sheet: n evenly spaced tiles (2 to 24, default 12)",
  "  --at <seconds>     Footage sheet: tiles at these times, like 1.5,30,61",
  "  --exact            Footage sheet: exact times instead of the keyframe before each",
  "  --rate <n>         Video scan: samples a second (default 4)",
  "  --engine <e>       Transcribe: auto (default), import, local or api",
  "  --language <code>  Transcribe: the spoken language, like en",
  "  --fresh            Transcribe: replace an existing transcript",
  "  --keep, --remove <ranges>  Cut plan: start-end seconds, like 192.4-211,264.2-290.6",
  "  --fillers <words>  Cut plan: filler words to drop, like um,uh",
  "  --max-pause <s>    Cut plan: shorten pauses longer than this",
  "  --pad <s>          Cut plan: seconds kept around each cut it makes (default 0.1)",
  "  --target <s>       Cut plan: warn when the cut misses this length",
  "  --type <t>         Asset search: image (default) or audio",
  "  --count <n>        Asset search: how many results (default 10)",
  "  --any-license      Asset search: include licences that don't allow commercial use",
  "  --openverse <type:id>  Asset add: an asset_search result, credit filled in",
  "  --name, --license, --author, --page, --title",
  "                     Asset add: what to call the file and how to credit it",
  "  --width --height   Page shot: the window size (default 1280 by 800)",
  "  --overwrite        Extract audio: replace a file already at --out",
  "  --preset <p>       Extract audio: m4a for the user (default) or transcribe (16 kHz WAV)",
  "  --from <s> --to <s>  Media tools: a range of the source, in seconds",
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
  threshold?: string;
  "min-quiet"?: string;
  peaks?: string;
  preset?: string;
  tiles?: string;
  exact?: boolean;
  rate?: string;
  engine?: string;
  language?: string;
  fresh?: boolean;
  keep?: string;
  remove?: string;
  fillers?: string;
  "max-pause"?: string;
  pad?: string;
  target?: string;
  template?: string;
  source?: string;
  type?: string;
  count?: string;
  "any-license"?: boolean;
  openverse?: string;
  name?: string;
  license?: string;
  author?: string;
  page?: string;
  height?: string;
  overwrite?: boolean;
};

const CHECK_GROUPS = ["purity", "layout", "intent", "motion", "style"];

function int(name: string, value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new UsageError(`--${name} must be a whole number.`);
  return n;
}

/** A decimal flag: any finite number of 0 or more. */
function num(
  name: string,
  value: string | undefined,
  what = "a number of seconds",
): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (value.trim() === "" || !Number.isFinite(n) || n < 0) {
    throw new UsageError(`--${name} must be ${what}.`);
  }
  return n;
}

/** A comma-separated list of seconds. */
function secondsList(name: string, value: string | undefined): number[] | undefined {
  if (value === undefined) return undefined;
  const list = value.split(",").map((v) => Number(v.trim()));
  if (list.some((n) => !Number.isFinite(n) || n < 0) || list.length === 0) {
    throw new UsageError(`--${name} must be seconds separated by commas, like 1.5,30,61.`);
  }
  return list;
}

/** Comma-separated `start-end` pairs of seconds. */
function ranges(
  name: string,
  value: string | undefined,
): { start: number; end: number }[] | undefined {
  if (value === undefined) return undefined;
  const pairs = value.split(",").map((pair) => {
    const m = /^\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*$/.exec(pair);
    const start = Number(m?.[1]);
    const end = Number(m?.[2]);
    return m && end > start ? { start, end } : null;
  });
  if (pairs.some((p) => p === null)) {
    throw new UsageError(
      `--${name} takes start-end pairs in seconds separated by commas, like 192.4-211,264.2-290.6.`,
    );
  }
  return pairs as { start: number; end: number }[];
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
    case "footage_add":
      return defined({ path: positionals[0] });
    case "media_info":
      return defined({ source: positionals[0] });
    case "media_audio":
      return defined({
        source: positionals[0],
        thresholdDb: num("threshold", values.threshold, "a number of decibels"),
        minQuiet: num("min-quiet", values["min-quiet"]),
        peaks: int("peaks", values.peaks),
      });
    case "media_sheet":
      return defined({
        source: positionals[0],
        tiles: int("tiles", values.tiles),
        from: num("from", values.from),
        to: num("to", values.to),
        at: secondsList("at", values.at),
        width: int("width", values.width),
        exact: values.exact,
      });
    case "media_video":
      return defined({
        source: positionals[0],
        from: num("from", values.from),
        to: num("to", values.to),
        rate: num("rate", values.rate, "a number of samples a second"),
      });
    case "transcribe":
      if (values.engine && !["auto", "import", "local", "api"].includes(values.engine)) {
        throw new UsageError("--engine must be auto, import, local or api.");
      }
      return defined({
        source: positionals[0],
        engine: values.engine,
        language: values.language,
        fresh: values.fresh,
      });
    case "cut_plan":
      return defined({
        composition,
        keep: ranges("keep", values.keep),
        remove: ranges("remove", values.remove),
        fillers: values.fillers
          ?.split(",")
          .map((f) => f.trim())
          .filter(Boolean),
        maxPause: num("max-pause", values["max-pause"]),
        pad: num("pad", values.pad),
        target: num("target", values.target),
      });
    case "asset_search":
      if (values.type && values.type !== "image" && values.type !== "audio") {
        throw new UsageError("--type must be image or audio.");
      }
      return defined({
        query: positionals.join(" ") || undefined,
        type: values.type,
        count: int("count", values.count),
        anyLicense: values["any-license"],
      });
    case "asset_add":
      return defined({
        from: positionals[0],
        openverse: values.openverse,
        name: values.name,
        license: values.license,
        author: values.author,
        page: values.page,
        title: values.title,
      });
    case "assets":
      return {};
    case "page_shot":
      return defined({
        url: positionals[0],
        width: int("width", values.width),
        height: int("height", values.height),
        name: values.name,
      });
    case "media_status":
      return defined({ job: positionals[0] });
    case "models": {
      const [action, name] = positionals;
      if (action === undefined || action === "list") return {};
      if (action === "install" && name === "parakeet") return { install: name };
      throw new UsageError("models takes list, or install parakeet.");
    }
    case "extract_audio":
      if (values.preset && values.preset !== "transcribe" && values.preset !== "m4a") {
        throw new UsageError("--preset must be transcribe or m4a.");
      }
      return defined({
        source: positionals[0],
        preset: values.preset,
        from: num("from", values.from),
        to: num("to", values.to),
        out: values.out,
        overwrite: values.overwrite,
      });
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
      if (values.template && values.template !== "title" && values.template !== "recut") {
        throw new UsageError("--template must be title or recut.");
      }
      return defined({
        title: values.title,
        id: values.id,
        group: values.group,
        description: values.description,
        format: values.format,
        seconds,
        template: values.template,
        source: values.source,
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
  // Everything after `smoove test` is Vitest's (file filters, -t, --reporter).
  if (argv[0] === "test") {
    const { runStudioCommand } = await import("./studio.js");
    return runStudioCommand("test", { args: argv.slice(1) }, io);
  }
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
        threshold: { type: "string" },
        "min-quiet": { type: "string" },
        peaks: { type: "string" },
        preset: { type: "string" },
        tiles: { type: "string" },
        exact: { type: "boolean" },
        rate: { type: "string" },
        engine: { type: "string" },
        language: { type: "string" },
        fresh: { type: "boolean" },
        keep: { type: "string" },
        remove: { type: "string" },
        fillers: { type: "string" },
        "max-pause": { type: "string" },
        pad: { type: "string" },
        target: { type: "string" },
        template: { type: "string" },
        source: { type: "string" },
        type: { type: "string" },
        count: { type: "string" },
        "any-license": { type: "boolean" },
        openverse: { type: "string" },
        name: { type: "string" },
        license: { type: "string" },
        author: { type: "string" },
        page: { type: "string" },
        height: { type: "string" },
        overwrite: { type: "boolean" },
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

/** The commands the command line runs itself: the studio, and detach. */
async function runLocal(name: string, values: Values, io: Io): Promise<number> {
  if (name === "start" || name === "build") {
    const { runStudioCommand } = await import("./studio.js");
    return runStudioCommand(name, { prod: values.prod, port: int("port", values.port) }, io);
  }
  if (name === "studio detach") {
    const { runDetach } = await import("./studio.js");
    return runDetach({ yes: values.yes }, io);
  }
  throw new UsageError(`Unknown command "${name}".`);
}

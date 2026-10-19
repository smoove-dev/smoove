import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  AGENT_PREFIX,
  type AgentResponse,
  type DrawnBy,
  type RenderData,
  type SeekData,
  type SheetData,
  type SnapshotData,
  type StatusData,
  type TimelineData,
  type TimelineNode,
} from "../index.js";
import {
  alive,
  DEV_FILE,
  DEV_LOG,
  type DevRecord,
  findPackageRoot,
  findProject,
  liveServer,
  packageManager,
  readDevRecord,
  readDiscoveryFile,
} from "./project.js";

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

const USAGE = `smoove: see and render the smoove studio from a shell.

Run it from inside the project. Every command takes --json for the raw answer.

  smoove start [--port <n>]       Start the studio dev server in the background
  smoove stop                     Stop the dev server smoove start started
  smoove status                   What the user's studio tab shows
  smoove seek <frame>             Move the user's playhead (or --at <beat>)
  smoove snap                     One frame as a PNG
  smoove sheet                    A contact sheet: one tile per beat
  smoove timeline                 Beats and sequences, in frames
  smoove render                   Render a video (only when the user asks for one)

Options:
  --comp <id>        The composition (default: the one the user is watching)
  --frame <n>        A frame, counting from 0
  --at <beat>        A beat: "hook" (its sheet frame), or hook.start, hook.settled,
                     hook.last or hook.end
  --width <px>       Image width (snap default 640; sheet tile default 320)
  --frames <n>       Sheet: n evenly spaced frames instead of one per beat (2 to 24)
  --format <f>       Render: mp4 (default) or webm
  --from <n> --to <n>  Render: a frame range, both inclusive
  --out <path>       Render: where the file goes (default out/<comp>.<format>)
  --no-wait          Render: return once the job is queued
  --json             Print the bridge's JSON answer`;

type Values = {
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
};

class UsageError extends Error {}

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
      },
    });
    values = parsed.values as Values;
    positionals = parsed.positionals;
  } catch (err) {
    io.err(`${err instanceof Error ? err.message : String(err)}\n\n${USAGE}`);
    return 2;
  }

  const [command, ...rest] = positionals;
  if (!command || values.help || command === "help") {
    io.out(USAGE);
    return command || values.help ? 0 : 2;
  }

  try {
    switch (command) {
      case "start":
        return await start(io, values);
      case "stop":
        return await stop(io, values);
      case "status":
        return await call(io, values, "GET", "status", undefined, formatStatus);
      case "seek":
        return await call(io, values, "POST", "seek", seekBody(values, rest), formatSeek);
      case "snap":
        return await call(io, values, "POST", "snapshot", snapBody(values), formatSnap);
      case "sheet":
        return await call(io, values, "POST", "sheet", sheetBody(values), formatSheet);
      case "timeline":
        return await call(
          io,
          values,
          "POST",
          "timeline",
          values.comp ? { composition: values.comp } : {},
          formatTimeline,
        );
      case "render":
        return await render(io, values);
      default:
        throw new UsageError(`Unknown command "${command}".`);
    }
  } catch (err) {
    if (err instanceof UsageError) {
      io.err(`${err.message}\n\n${USAGE}`);
      return 2;
    }
    throw err;
  }
}

// ---------------------------------------------------------------- arguments

function int(name: string, value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new UsageError(`--${name} must be a whole number.`);
  return n;
}

function seekBody(v: Values, rest: string[]): Record<string, unknown> {
  const frame = int("frame", rest[0] ?? v.frame);
  if (frame === undefined && !v.at) throw new UsageError("seek needs a frame or --at <beat>.");
  return {
    frame: frame ?? 0,
    ...(v.at ? { at: v.at } : {}),
    ...(v.comp ? { composition: v.comp } : {}),
  };
}

function snapBody(v: Values): Record<string, unknown> {
  const frame = int("frame", v.frame);
  const width = int("width", v.width);
  return {
    ...(frame !== undefined ? { frame } : {}),
    ...(v.at ? { at: v.at } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(v.comp ? { composition: v.comp } : {}),
  };
}

function sheetBody(v: Values): Record<string, unknown> {
  const frames = int("frames", v.frames);
  const width = int("width", v.width);
  return {
    ...(frames !== undefined ? { frames } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(v.comp ? { composition: v.comp } : {}),
  };
}

// ---------------------------------------------------------------- talking to the bridge

type Server = { root: string; url: string; token: string };

function server(io: Io): Server | null {
  const root = findProject(io.cwd);
  if (!root) return null;
  const info = liveServer(root);
  return info ? { root, url: info.url, token: info.token } : null;
}

function noServer(io: Io, values: Values): number {
  const message =
    "No smoove dev server is running for this project. Run `smoove start` from the project folder.";
  if (values.json) io.out(JSON.stringify({ ok: false, error: { code: "no-server", message } }));
  else io.err(message);
  return 1;
}

async function request<T>(
  s: Server,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<AgentResponse<T> | null> {
  try {
    const res = await fetch(new URL(`${AGENT_PREFIX.slice(1)}${path}`, s.url), {
      method,
      headers: {
        Authorization: `Bearer ${s.token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return (await res.json()) as AgentResponse<T>;
  } catch {
    return null;
  }
}

async function call<T>(
  io: Io,
  values: Values,
  method: "GET" | "POST",
  path: string,
  body: unknown,
  format: (data: T, answer: AgentResponse<T>) => string,
): Promise<number> {
  const s = server(io);
  if (!s) return noServer(io, values);
  const answer = await request<T>(s, method, path, body);
  if (!answer) return noServer(io, values);
  return print(io, values, answer, format);
}

function print<T>(
  io: Io,
  values: Values,
  answer: AgentResponse<T>,
  format: (data: T, answer: AgentResponse<T>) => string,
): number {
  if (values.json) {
    io.out(JSON.stringify(answer));
    return answer.ok ? 0 : 1;
  }
  if (answer.ok) io.out(format(answer.data, answer));
  else io.err(`Error (${answer.error.code}): ${answer.error.message}`);
  for (const w of answer.warnings ?? []) io.err(`Warning: ${w}`);
  return answer.ok ? 0 : 1;
}

// ---------------------------------------------------------------- formatting

function who(by: DrawnBy | undefined): string {
  if (!by) return "";
  return by.headless ? "the headless tab" : `the user's tab at ${by.path}`;
}

function range(start: number, end: number): string {
  return end - 1 > start ? `frames ${start} to ${end - 1}` : `frame ${start}`;
}

export function formatStatus(data: StatusData): string {
  const lines = [`Studio: ${data.server.url}`];
  const users = data.server.tabs.filter((t) => !t.owned);
  const owned = data.server.tabs.some((t) => t.owned);
  lines.push(
    `Tabs: ${users.length === 0 ? "no user tab" : `${users.length} user tab${users.length === 1 ? "" : "s"}`}${owned ? ", plus the headless tab" : ""}`,
  );
  const active = data.studio?.active;
  if (!data.studio) {
    lines.push(`Nobody has the studio open. Give the user this URL: ${data.openUrl}`);
  } else if (!active) {
    lines.push("The user's tab has no composition open.");
  } else if (active.loadStatus === "error") {
    lines.push(`Showing ${active.id}, which failed to build: ${active.error}`);
  } else {
    const parts = [`Showing ${active.id}`];
    if (active.frame != null && active.durationInFrames != null) {
      parts.push(`frame ${active.frame} of frames 0 to ${active.durationInFrames - 1}`);
    }
    if (active.fps != null) parts.push(`${active.fps} fps`);
    if (active.width != null) parts.push(`${active.width} by ${active.height}`);
    parts.push(active.playing ? "playing" : "paused");
    if (active.assets === "buffering" || active.loadStatus === "loading")
      parts.push("still loading");
    lines.push(parts.join(", "));
  }
  if (data.studio) lines.push(`Compositions: ${data.studio.catalog.map((c) => c.id).join(", ")}`);
  return lines.join("\n");
}

function formatSeek(data: SeekData): string {
  return `The user's tab now shows ${data.composition} at frame ${data.frame}.`;
}

function formatSnap(data: SnapshotData, answer: AgentResponse<SnapshotData>): string {
  return `${data.path}\n${data.composition}, frame ${data.frame}, ${data.width} by ${data.height}, drawn by ${who(answer.drawnBy)}.`;
}

function formatSheet(data: SheetData, answer: AgentResponse<SheetData>): string {
  const how = data.mode === "beats" ? "one tile per beat" : "evenly spaced frames";
  const tiles = data.tiles.map((t) => (t.beat ? `${t.frame} ${t.beat}` : String(t.frame)));
  return [
    data.path,
    `${data.composition}, ${data.tiles.length} tiles, ${how}, each ${data.tileWidth} by ${data.tileHeight}, drawn by ${who(answer.drawnBy)}.`,
    `Frames: ${tiles.join(", ")}`,
  ].join("\n");
}

export function formatTimeline(data: TimelineData): string {
  const lines = [
    `${data.composition}: ${data.width} by ${data.height}, ${data.fps} fps, ${data.durationInFrames} frames (frames 0 to ${data.durationInFrames - 1})`,
  ];
  if (data.beats.length > 0) {
    lines.push(
      data.beatsFrom === "plan" ? "Beats, from the plan:" : "Beats, from the top-level sequences:",
    );
    for (const b of data.beats) {
      const settled = b.settled !== b.start ? `, settled at ${b.settled}` : "";
      lines.push(`  ${b.name}: ${range(b.start, b.end)}${settled}, sheet frame ${b.sheet}`);
    }
  }
  lines.push("Sequences:");
  const walk = (nodes: TimelineNode[], depth: number): void => {
    for (const n of nodes) {
      lines.push(`${"  ".repeat(depth)}${n.name} (${n.kind}): ${range(n.start, n.end)}`);
      walk(n.children, depth + 1);
    }
  };
  walk(data.sequences, 1);
  return lines.join("\n");
}

// ---------------------------------------------------------------- render

async function render(io: Io, values: Values): Promise<number> {
  const s = server(io);
  if (!s) return noServer(io, values);
  const from = int("from", values.from);
  const to = int("to", values.to);
  if ((from === undefined) !== (to === undefined)) {
    throw new UsageError("Give both --from and --to, or neither.");
  }
  if (values.format && values.format !== "mp4" && values.format !== "webm") {
    throw new UsageError("--format must be mp4 or webm.");
  }
  const body = {
    ...(values.comp ? { composition: values.comp } : {}),
    ...(values.format ? { format: values.format } : {}),
    ...(from !== undefined ? { from, to } : {}),
    ...(values.out ? { out: resolve(io.cwd, values.out) } : {}),
  };
  const queued = await request<RenderData>(s, "POST", "render", body);
  if (!queued) return noServer(io, values);
  if (!queued.ok || values["no-wait"]) {
    return print(
      io,
      values,
      queued,
      (d) => `Queued render ${d.jobId} of ${d.composition}. It will be written to ${d.out}.`,
    );
  }

  let last: AgentResponse<RenderData> = queued;
  let shown = -1;
  if (!values.json) io.out(`Rendering ${queued.data.composition} to ${queued.data.out}`);
  for (;;) {
    const data: RenderData | null = last.ok ? last.data : null;
    if (!data) break;
    if (data.status === "done" || data.status === "error" || data.status === "canceled") break;
    if (!values.json) {
      const pct = Math.floor(data.progress * 100);
      if (pct >= shown + 10 || (data.status === "saving" && shown < 100)) {
        shown = data.status === "saving" ? 100 : pct;
        io.out(data.status === "saving" ? "Saving the file" : `${pct} percent`);
      }
    }
    await io.sleep(1000);
    const next: AgentResponse<RenderData> | null = await request<RenderData>(
      s,
      "GET",
      `render/${encodeURIComponent(data.jobId)}`,
    );
    if (!next) return noServer(io, values);
    last = next;
  }
  if (last.ok && last.data.status === "error") {
    last = {
      ok: false,
      error: { code: "render-error", message: last.data.error ?? "The render failed." },
      drawnBy: last.drawnBy,
    };
  } else if (last.ok && last.data.status === "canceled") {
    last = {
      ok: false,
      error: { code: "render-error", message: "The render was canceled in the studio." },
      drawnBy: last.drawnBy,
    };
  }
  return print(io, values, last, (d) => `${d.out}\nRendered ${d.composition} as ${d.format}.`);
}

// ---------------------------------------------------------------- start and stop

async function start(io: Io, values: Values): Promise<number> {
  const root = findProject(io.cwd) ?? findPackageRoot(io.cwd);
  if (!root) {
    return fail(
      io,
      values,
      "no-server",
      "There's no package.json with a dev script here or above.",
    );
  }
  const running = liveServer(root);
  if (running) {
    return done(io, values, { url: running.url, pid: running.pid, alreadyRunning: true }, [
      `The studio is already running at ${running.url}`,
      `Give this URL to the user so they can watch: ${running.url}`,
    ]);
  }

  const port = int("port", values.port);
  const pm = packageManager(root);
  const args = ["run", "dev"];
  if (port !== undefined) args.push(...(pm === "npm" ? ["--"] : []), "--port", String(port));
  mkdirSync(join(root, ".smoove"), { recursive: true });
  const logFile = join(root, DEV_LOG);
  const log = openSync(logFile, "w");
  const startedAt = Date.now();
  const child = spawn(pm, args, {
    cwd: root,
    detached: true,
    stdio: ["ignore", log, log],
    env: io.env,
  });
  closeSync(log);
  let exited = false;
  child.once("exit", () => {
    exited = true;
  });
  child.once("error", () => {
    exited = true;
  });
  child.unref();
  if (child.pid == null) {
    return fail(io, values, "no-server", `Couldn't run "${pm} ${args.join(" ")}".`);
  }
  const record: DevRecord = {
    pid: child.pid,
    startedAt: new Date(startedAt).toISOString(),
    command: `${pm} ${args.join(" ")}`,
  };
  writeFileSync(join(root, DEV_FILE), `${JSON.stringify(record, null, 2)}\n`);

  const deadline = startedAt + 60_000;
  while (Date.now() < deadline) {
    const info = readDiscoveryFile(root);
    if (info && alive(info.pid) && Date.parse(info.startedAt) >= startedAt - 1000) {
      return done(io, values, { url: info.url, pid: info.pid, alreadyRunning: false }, [
        `The studio is running at ${info.url}`,
        `Give this URL to the user so they can watch: ${info.url}`,
        `Its output goes to ${logFile}. Stop it with: smoove stop`,
      ]);
    }
    if (exited) break;
    await io.sleep(250);
  }
  const tail = readTail(logFile);
  if (!exited) killGroup(child.pid, "SIGKILL");
  rmSync(join(root, DEV_FILE), { force: true });
  return fail(
    io,
    values,
    "no-server",
    `The dev server ${exited ? "exited" : "didn't start within 60 seconds"}. Is the smoove Vite plugin installed with its agent option on? The end of ${logFile}:\n${tail}`,
  );
}

async function stop(io: Io, values: Values): Promise<number> {
  const root = findProject(io.cwd) ?? findPackageRoot(io.cwd);
  const record = root ? readDevRecord(root) : null;
  const running = root ? liveServer(root) : null;
  if (!root || !record || !alive(record.pid)) {
    if (root) rmSync(join(root, DEV_FILE), { force: true });
    if (running) {
      return fail(
        io,
        values,
        "no-server",
        `The dev server at ${running.url} wasn't started by smoove start, so smoove won't stop it. Stop it where it was started.`,
      );
    }
    return done(io, values, { stopped: false }, ["No dev server is running."]);
  }
  killGroup(record.pid, "SIGTERM");
  const deadline = Date.now() + 10_000;
  while (alive(record.pid) && Date.now() < deadline) await io.sleep(200);
  if (alive(record.pid)) killGroup(record.pid, "SIGKILL");
  rmSync(join(root, DEV_FILE), { force: true });
  const info = readDiscoveryFile(root);
  if (info && !alive(info.pid)) rmSync(join(root, ".smoove", "agent.json"), { force: true });
  return done(io, values, { stopped: true }, ["Stopped the studio dev server."]);
}

function killGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // Already gone.
    }
  }
}

function readTail(file: string): string {
  try {
    return readFileSync(file, "utf8").split("\n").slice(-15).join("\n");
  } catch {
    return "(no output)";
  }
}

function done(io: Io, values: Values, data: unknown, lines: string[]): number {
  if (values.json) io.out(JSON.stringify({ ok: true, data }));
  else io.out(lines.join("\n"));
  return 0;
}

function fail(io: Io, values: Values, code: string, message: string): number {
  if (values.json) io.out(JSON.stringify({ ok: false, error: { code, message } }));
  else io.err(message);
  return 1;
}

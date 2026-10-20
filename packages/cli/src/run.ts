/**
 * What each command does. Every function returns a {@link CommandResult}
 * and prints nothing, so the command line and the MCP server can each
 * present it their own way.
 */
import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  AGENT_PREFIX,
  type AgentResponse,
  type CheckData,
  type ContextData,
  type RenderData,
  type SheetData,
  type SnapshotData,
  type StatusData,
  type TimelineData,
} from "@smoove/agent";
import { type CommandImage, type CommandResult, type RunContext, spell } from "./commands.js";
import {
  findingLines,
  formatCheck,
  formatContext,
  formatSeek,
  formatSheet,
  formatSnap,
  formatStatus,
  formatTimeline,
  lintAsFinding,
  plural,
} from "./format.js";
import { type LintFinding, lintProject } from "./lint/lint.js";
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

// ---------------------------------------------------------------- results

/** A result from the bridge's answer: its text when it worked, its error when it didn't. */
function fromAnswer<T>(
  answer: AgentResponse<T>,
  format: (data: T, answer: AgentResponse<T>) => string,
  images: (data: T) => CommandImage[] = () => [],
): CommandResult {
  const warnings = (answer.warnings ?? []).map((w) => `Warning: ${w}`);
  if (answer.ok) {
    return {
      code: 0,
      answer,
      text: format(answer.data, answer),
      errors: warnings.join("\n"),
      images: images(answer.data),
    };
  }
  return {
    code: 1,
    answer,
    text: "",
    errors: [`Error (${answer.error.code}): ${answer.error.message}`, ...warnings].join("\n"),
    images: [],
  };
}

export function done(data: unknown, lines: string[]): CommandResult {
  return { code: 0, answer: { ok: true, data }, text: lines.join("\n"), errors: "", images: [] };
}

export function fail(code: string, message: string): CommandResult {
  return {
    code: 1,
    answer: { ok: false, error: { code, message } },
    text: "",
    errors: message,
    images: [],
  };
}

// ---------------------------------------------------------------- talking to the bridge

type Server = { root: string; url: string; token: string };

function server(ctx: RunContext): Server | null {
  const root = findProject(ctx.cwd);
  if (!root) return null;
  const info = liveServer(root);
  return info ? { root, url: info.url, token: info.token } : null;
}

function noServer(ctx: RunContext): CommandResult {
  const next =
    ctx.door === "mcp"
      ? "Call the start tool, then give the user the URL it returns."
      : `Run \`${spell(ctx, "start")}\` from the project folder.`;
  return fail("no-server", `No smoove dev server is running for this project. ${next}`);
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
  ctx: RunContext,
  method: "GET" | "POST",
  path: string,
  body: unknown,
  format: (data: T, answer: AgentResponse<T>) => string,
  images?: (data: T) => CommandImage[],
): Promise<CommandResult> {
  const s = server(ctx);
  if (!s) return noServer(ctx);
  const answer = await request<T>(s, method, path, body);
  if (!answer) return noServer(ctx);
  return fromAnswer(answer, format, images);
}

/** Copy the defined fields only, so the bridge sees no `undefined`. */
function defined(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
}

// ---------------------------------------------------------------- looking

export function runStatus(ctx: RunContext): Promise<CommandResult> {
  return call<StatusData>(ctx, "GET", "status", undefined, formatStatus);
}

export function runSeek(
  ctx: RunContext,
  input: { frame?: number; at?: string; composition?: string },
): Promise<CommandResult> {
  const body = defined({ frame: input.frame ?? 0, at: input.at, composition: input.composition });
  return call(ctx, "POST", "seek", body, formatSeek);
}

export function runSnap(
  ctx: RunContext,
  input: { composition?: string; frame?: number; at?: string; width?: number },
): Promise<CommandResult> {
  return call<SnapshotData>(ctx, "POST", "snapshot", defined(input), formatSnap, (d) => [
    { path: d.path, inline: true },
  ]);
}

export function runSheet(
  ctx: RunContext,
  input: { composition?: string; frames?: number; width?: number },
): Promise<CommandResult> {
  return call<SheetData>(ctx, "POST", "sheet", defined(input), formatSheet, (d) => [
    { path: d.path, inline: true },
  ]);
}

export function runTimeline(
  ctx: RunContext,
  input: { composition?: string },
): Promise<CommandResult> {
  return call<TimelineData>(ctx, "POST", "timeline", defined(input), formatTimeline);
}

export function runContext(ctx: RunContext, input: { image?: boolean }): Promise<CommandResult> {
  return call<ContextData>(ctx, "POST", "context", {}, formatContext, (d) =>
    d.mark?.image ? [{ path: d.mark.image, inline: input.image === true }] : [],
  );
}

// ---------------------------------------------------------------- render

export async function runRender(
  ctx: RunContext,
  input: {
    composition?: string;
    format?: "mp4" | "webm";
    from?: number;
    to?: number;
    out?: string;
    wait?: boolean;
  },
): Promise<CommandResult> {
  const s = server(ctx);
  if (!s) return noServer(ctx);
  const body = defined({
    composition: input.composition,
    format: input.format,
    from: input.from,
    to: input.from !== undefined ? input.to : undefined,
    out: input.out ? resolve(ctx.cwd, input.out) : undefined,
  });
  const queued = await request<RenderData>(s, "POST", "render", body);
  if (!queued) return noServer(ctx);
  if (!queued.ok || input.wait === false) {
    return fromAnswer(
      queued,
      (d) => `Queued render ${d.jobId} of ${d.composition}. It will be written to ${d.out}.`,
    );
  }

  let last: AgentResponse<RenderData> = queued;
  let shown = -1;
  const waitStarted = Date.now();
  ctx.progress?.({
    progress: 0,
    total: 100,
    message: `Rendering ${queued.data.composition} to ${queued.data.out}`,
  });
  for (;;) {
    const data: RenderData | null = last.ok ? last.data : null;
    if (!data) break;
    if (data.status === "done" || data.status === "error" || data.status === "canceled") break;
    if (ctx.maxWaitMs !== undefined && Date.now() - waitStarted > ctx.maxWaitMs) {
      const follow =
        ctx.door === "mcp"
          ? spell(ctx, "render_status")
          : `${spell(ctx, "render_status")} ${data.jobId}`;
      return done(data, [
        `Render ${data.jobId} of ${data.composition} is still rendering (${Math.floor(data.progress * 100)} percent). It goes on in the studio's queue and will be written to ${data.out}.`,
        `Check on it with ${follow}, job ${data.jobId}.`,
      ]);
    }
    if (ctx.signal?.aborted) {
      return done(data, [
        `Stopped waiting for render ${data.jobId}. It goes on in the studio's queue and will be written to ${data.out}.`,
      ]);
    }
    const pct = Math.floor(data.progress * 100);
    if (pct >= shown + 10 || (data.status === "saving" && shown < 100)) {
      shown = data.status === "saving" ? 100 : Math.max(pct, shown + 1);
      ctx.progress?.({
        progress: shown,
        total: 100,
        message: data.status === "saving" ? "Saving the file" : `${pct} percent`,
      });
    }
    await ctx.sleep(1000);
    const next: AgentResponse<RenderData> | null = await request<RenderData>(
      s,
      "GET",
      `render/${encodeURIComponent(data.jobId)}`,
    );
    if (!next) return noServer(ctx);
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
  return fromAnswer(last, (d) => `${d.out}\nRendered ${d.composition} as ${d.format}.`);
}

export function runRenderStatus(ctx: RunContext, input: { job: string }): Promise<CommandResult> {
  return call<RenderData>(ctx, "GET", `render/${encodeURIComponent(input.job)}`, undefined, (d) => {
    const pct = Math.floor(d.progress * 100);
    switch (d.status) {
      case "done":
        return `${d.out}\nRender ${d.jobId} of ${d.composition} is done.`;
      case "error":
        return `Render ${d.jobId} of ${d.composition} failed: ${d.error ?? "no reason given"}.`;
      case "canceled":
        return `Render ${d.jobId} of ${d.composition} was canceled in the studio.`;
      default:
        return `Render ${d.jobId} of ${d.composition} is ${d.status === "queued" ? "queued" : `${d.status === "saving" ? "saving the file" : "rendering"}, ${pct} percent`}. It will be written to ${d.out}.`;
    }
  });
}

// ---------------------------------------------------------------- start and stop

export async function runStart(ctx: RunContext, input: { port?: number }): Promise<CommandResult> {
  const root = findProject(ctx.cwd) ?? findPackageRoot(ctx.cwd);
  if (!root) return fail("no-server", "There's no package.json with a dev script here or above.");
  const running = liveServer(root);
  if (running) {
    return done({ url: running.url, pid: running.pid, alreadyRunning: true }, [
      `The studio is already running at ${running.url}`,
      `Give this URL to the user so they can watch: ${running.url}`,
    ]);
  }

  const pm = packageManager(root);
  const args = ["run", "dev"];
  if (input.port !== undefined) {
    args.push(...(pm === "npm" ? ["--"] : []), "--port", String(input.port));
  }
  mkdirSync(join(root, ".smoove"), { recursive: true });
  const logFile = join(root, DEV_LOG);
  const log = openSync(logFile, "w");
  const startedAt = Date.now();
  const child = spawn(pm, args, {
    cwd: root,
    detached: true,
    stdio: ["ignore", log, log],
    env: ctx.env,
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
  if (child.pid == null) return fail("no-server", `Couldn't run "${pm} ${args.join(" ")}".`);
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
      return done({ url: info.url, pid: info.pid, alreadyRunning: false }, [
        `The studio is running at ${info.url}`,
        `Give this URL to the user so they can watch: ${info.url}`,
        `Its output goes to ${logFile}. Stop it with: ${spell(ctx, "stop")}`,
      ]);
    }
    if (exited) break;
    await ctx.sleep(250);
  }
  const tail = readTail(logFile);
  if (!exited) killGroup(child.pid, "SIGKILL");
  rmSync(join(root, DEV_FILE), { force: true });
  return fail(
    "no-server",
    `The dev server ${exited ? "exited" : "didn't start within 60 seconds"}. Is the smoove Vite plugin installed with its agent option on? The end of ${logFile}:\n${tail}`,
  );
}

export async function runStop(ctx: RunContext): Promise<CommandResult> {
  const root = findProject(ctx.cwd) ?? findPackageRoot(ctx.cwd);
  const record = root ? readDevRecord(root) : null;
  const running = root ? liveServer(root) : null;
  if (!root || !record || !alive(record.pid)) {
    if (root) rmSync(join(root, DEV_FILE), { force: true });
    if (running) {
      return fail(
        "no-server",
        `The dev server at ${running.url} wasn't started by ${spell(ctx, "start")}, so smoove won't stop it. Stop it where it was started.`,
      );
    }
    return done({ stopped: false }, ["No dev server is running."]);
  }
  killGroup(record.pid, "SIGTERM");
  const deadline = Date.now() + 10_000;
  while (alive(record.pid) && Date.now() < deadline) await ctx.sleep(200);
  if (alive(record.pid)) killGroup(record.pid, "SIGKILL");
  rmSync(join(root, DEV_FILE), { force: true });
  const info = readDiscoveryFile(root);
  if (info && !alive(info.pid)) rmSync(join(root, ".smoove", "agent.json"), { force: true });
  return done({ stopped: true }, ["Stopped the studio dev server."]);
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

// ---------------------------------------------------------------- check

function lintFor(ctx: RunContext): LintFinding[] {
  const root = findPackageRoot(ctx.cwd);
  return root ? lintProject(root) : [];
}

export async function runCheck(
  ctx: RunContext,
  input: { composition?: string; all?: boolean; groups?: string[]; images?: boolean },
): Promise<CommandResult> {
  const groups = input.groups;
  const lint = !groups || groups.includes("purity") ? lintFor(ctx) : [];

  const s = server(ctx);
  if (!s) {
    const message = `The other checks need the studio. ${
      ctx.door === "mcp" ? "Call the start tool." : `Run npx ${spell(ctx, "start")}.`
    }`;
    const lines = [`Lint: ${plural(lint.length, "warning")}.`];
    for (const l of lint) lines.push("", ...findingLines(lintAsFinding(l, "")));
    return {
      code: 1,
      answer: { ok: false, error: { code: "no-server", message }, data: { reports: [], lint } },
      text: lines.join("\n"),
      errors: message,
      images: [],
    };
  }

  const body = (composition: string | undefined) =>
    defined({ composition, groups, images: input.images ? true : undefined });
  const reports: CheckData[] = [];
  const first = await request<CheckData>(s, "POST", "check", body(input.composition));
  if (!first) return noServer(ctx);
  if (!first.ok) return fromAnswer(first, () => "");
  reports.push(first.data);
  if (input.all) {
    for (const id of first.data.catalog) {
      if (id === first.data.composition) continue;
      const next = await request<CheckData>(s, "POST", "check", body(id));
      if (!next) return noServer(ctx);
      if (!next.ok) return fromAnswer(next, () => "");
      reports.push(next.data);
    }
  }

  const failed = reports.some((r) => r.findings.some((f) => f.severity === "error"));
  const images: CommandImage[] = reports.flatMap((r) =>
    r.findings.flatMap((f) => (f.image ? [{ path: f.image, inline: false }] : [])),
  );
  return {
    code: failed ? 1 : 0,
    answer: { ok: true, data: { reports, lint } },
    text: reports.map((r, i) => formatCheck(r, i === 0 ? lint : [])).join("\n\n"),
    errors: "",
    images,
  };
}

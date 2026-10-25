/**
 * Long media work (transcribing, scanning video) as jobs on disk, so the
 * command line can check on one the MCP server started, a restarted server
 * still knows it, and asking twice joins the running job instead of decoding
 * again. A job lives at `.smoove/media/<name>-<key>/jobs/<kind>.json`.
 */
import { basename, dirname, join } from "node:path";
import { MEDIA_DIR, type MediaJob, type MediaJobKind } from "@smoove/agent";
import type { RunContext } from "../commands.js";
import { alive } from "../project.js";
import { MediaError, mediaKey, readCached, writeAtomic } from "./cache.js";

/** How often a running job rewrites its file with progress. */
const REPORT_MS = 500;
/** How often a waiter rereads a job file. */
const POLL_MS = 1000;

/**
 * A job's id. `variant` tells apart jobs of one kind on one source that do
 * different work, like an audio map with other thresholds or a video scan of
 * another range, so neither joins the other.
 */
export function jobId(kind: MediaJobKind, name: string, key: string, variant?: string): string {
  const tag = variant ? `-${variant.replace(/[^a-z0-9-]+/gi, "_")}` : "";
  return `${kind}${tag}.${name}-${key}`;
}

function jobFile(root: string, id: string): string | null {
  const dot = id.indexOf(".");
  if (dot <= 0) return null;
  return join(root, MEDIA_DIR, id.slice(dot + 1), "jobs", `${id.slice(0, dot)}.json`);
}

/** A job's state, `"stale"` when it says running but its process is gone, null when unknown. */
export function readJob(root: string, id: string): MediaJob | "stale" | null {
  const file = jobFile(root, id);
  if (!file) return null;
  const job = readCached<MediaJob>(dirname(file), basename(file));
  if (!job) return null;
  if (job.status === "running" && !alive(job.pid)) return "stale";
  return job;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Wait on a job another process runs. When that process dies, the job
 * settles as an error here rather than rejecting, so a waiter never leaves
 * an unhandled rejection behind.
 */
async function follow(root: string, id: string, last: MediaJob): Promise<MediaJob> {
  let seen = last;
  for (;;) {
    await sleep(POLL_MS);
    const job = readJob(root, id);
    if (job === "stale" || job === null) {
      return {
        ...seen,
        status: "error",
        error: {
          code: "media-error",
          message: `Job ${id} stopped when its process ended. Call the tool again to restart it.`,
        },
      };
    }
    seen = job;
    if (job.status !== "running") return job;
  }
}

export interface StartedJob {
  id: string;
  root: string;
  promise: Promise<MediaJob>;
  attached: boolean;
}

/** In-process jobs, so a second start in the same process shares the first one's promise. */
const running = new Map<string, Promise<MediaJob>>();

/**
 * Run `work` as the `kind` job for `source`, or join the one already running
 * with the same `variant`. `work` returns the project-relative paths it wrote.
 */
export function startJob(
  root: string,
  kind: MediaJobKind,
  source: string,
  work: (
    report: (progress: number, message: string) => void,
    signal: AbortSignal,
  ) => Promise<string[]>,
  variant?: string,
): StartedJob {
  const { name, key } = mediaKey(root, source);
  const id = jobId(kind, name, key, variant);
  const inProcess = running.get(id);
  if (inProcess) return { id, root, promise: inProcess, attached: true };
  const existing = readJob(root, id);
  if (existing !== "stale" && existing?.status === "running") {
    return { id, root, promise: follow(root, id, existing), attached: true };
  }

  const file = jobFile(root, id) as string;
  const now = () => new Date().toISOString();
  const job: MediaJob = {
    id,
    kind,
    source,
    status: "running",
    progress: 0,
    message: "",
    pid: process.pid,
    started: now(),
    updated: now(),
  };
  const save = () => writeAtomic(file, JSON.stringify({ ...job, updated: now() }, null, 2));
  save();

  let lastSave = Date.now();
  const report = (progress: number, message: string) => {
    job.progress = Math.max(0, Math.min(1, progress));
    job.message = message;
    if (Date.now() - lastSave >= REPORT_MS) {
      lastSave = Date.now();
      save();
    }
  };

  const promise = (async () => {
    try {
      job.result = await work(report, new AbortController().signal);
      job.status = "done";
      job.progress = 1;
    } catch (err) {
      job.status = "error";
      job.error =
        err instanceof MediaError
          ? { code: err.code, message: err.message }
          : { code: "media-error", message: err instanceof Error ? err.message : String(err) };
    } finally {
      save();
      running.delete(id);
    }
    return { ...job };
  })();
  running.set(id, promise);
  return { id, root, promise, attached: false };
}

/**
 * Wait for a job, forwarding its progress, up to `ctx.maxWaitMs`. Past that,
 * hand back its id: the work goes on, and `media_status` reads it later.
 */
export async function awaitJob(
  ctx: RunContext,
  job: Pick<StartedJob, "id" | "root" | "promise">,
): Promise<MediaJob | { handedBack: string }> {
  const started = Date.now();
  const done: { job: MediaJob | null } = { job: null };
  void job.promise.then((j) => {
    done.job = j;
  });
  for (;;) {
    if (done.job) return done.job;
    if (ctx.maxWaitMs !== undefined && Date.now() - started >= ctx.maxWaitMs) {
      return { handedBack: job.id };
    }
    const wait = ctx.maxWaitMs === undefined ? POLL_MS : Math.min(POLL_MS, ctx.maxWaitMs);
    await Promise.race([job.promise, sleep(wait)]);
    if (done.job) return done.job;
    const now = readJob(job.root, job.id);
    if (now && now !== "stale" && ctx.progress) {
      ctx.progress({ progress: Math.round(now.progress * 100), total: 100, message: now.message });
    }
  }
}

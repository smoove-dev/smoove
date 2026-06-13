import type { Composition } from "@konva-motion/core";
import {
  type SetupOptions,
  renderComposition,
  renderStill,
  setupServerRendering,
} from "@konva-motion/renderer";
import { makeJobId } from "../lib/ids.js";
import type { RenderRequest } from "../types.js";
import { stillMeta, toRenderOptions, toStillOptions, videoMeta } from "./map.js";
import { createTempStorage } from "./temp-storage.js";
import type { RenderQueueJob, RenderStorage, StoredArtifact } from "./types.js";

export interface CreateRenderQueueOptions {
  /**
   * Turn a request into a rendering-mode {@link Composition} with its props
   * applied. MUST resolve a composition built AFTER `setupServerRendering()` ran
   * (the queue calls it before `resolve`), so the engine is in rendering mode.
   */
  resolve: (req: RenderRequest) => Promise<Composition>;
  /** Where artifacts are written. Default: {@link createTempStorage}. */
  storage?: RenderStorage;
  /** Forwarded to `setupServerRendering` once on first render (fonts, etc.). */
  setup?: SetupOptions;
  /**
   * Max renders running at once. Default 1 — safe when `resolve` returns a
   * cached/module-singleton composition, since a render mutates frame state.
   */
  concurrency?: number;
}

export interface RenderQueue {
  /** Create a job and kick off its render. Returns the queued job immediately. */
  enqueue(req: RenderRequest): RenderQueueJob;
  get(jobId: string): RenderQueueJob | undefined;
  list(): RenderQueueJob[];
  /** Abort an in-flight (or not-yet-started) job. */
  cancel(jobId: string): void;
  /** Forget a job and drop its artifact. */
  remove(jobId: string): Promise<void>;
  /**
   * Listen for changes to one job. The current state is delivered synchronously
   * on subscribe, then again on every update. Returns an unsubscribe function.
   */
  subscribe(jobId: string, fn: (job: RenderQueueJob) => void): () => void;
  /** The finished artifact for a job, or null. */
  download(jobId: string): Promise<StoredArtifact | null>;
}

/**
 * An in-memory render queue — the only implementation the package ships. It
 * owns nothing HTTP: it runs renders via `@konva-motion/renderer`, tracks job
 * state, and pushes progress to subscribers. A host wraps it in whatever
 * transport it likes (the demo: React Router resource routes + SSE).
 */
export function createRenderQueue(opts: CreateRenderQueueOptions): RenderQueue {
  const storage = opts.storage ?? createTempStorage();
  const concurrency = Math.max(1, opts.concurrency ?? 1);

  const jobs = new Map<string, RenderQueueJob>();
  const listeners = new Map<string, Set<(job: RenderQueueJob) => void>>();
  const aborts = new Map<string, AbortController>();

  // ---- concurrency gate ----------------------------------------------------
  let active = 0;
  const waiting: Array<() => void> = [];
  const pump = (): void => {
    while (active < concurrency && waiting.length > 0) {
      active++;
      const run = waiting.shift();
      run?.();
    }
  };
  const release = (): void => {
    active--;
    pump();
  };

  // ---- setup (once) --------------------------------------------------------
  let didSetup = false;
  const ensureSetup = (): void => {
    if (didSetup) return;
    setupServerRendering(opts.setup);
    didSetup = true;
  };

  // ---- state notify --------------------------------------------------------
  const emit = (jobId: string): void => {
    const job = jobs.get(jobId);
    if (!job) return;
    const set = listeners.get(jobId);
    if (!set) return;
    for (const fn of set) fn(job);
  };
  const update = (jobId: string, patch: Partial<RenderQueueJob>): void => {
    const job = jobs.get(jobId);
    if (!job) return;
    jobs.set(jobId, { ...job, ...patch });
    emit(jobId);
  };

  // ---- the render --------------------------------------------------------
  const run = async (jobId: string): Promise<void> => {
    const job = jobs.get(jobId);
    if (!job || job.status === "canceled") return;

    const ac = new AbortController();
    aborts.set(jobId, ac);
    update(jobId, { status: "rendering" });

    try {
      const comp = await opts.resolve(job.request);
      if (ac.signal.aborted) return;

      const meta =
        job.request.kind === "still"
          ? stillMeta(job.request.format)
          : videoMeta(job.request.format);
      const { path, finalize } = await storage.put(jobId, {
        ext: meta.ext,
        contentType: meta.contentType,
        filename: `${job.request.id}.${meta.ext}`,
      });

      if (job.request.kind === "still") {
        await renderStill(comp, toStillOptions(job.request, path));
      } else {
        await renderComposition(comp, {
          ...toRenderOptions(job.request, path),
          signal: ac.signal,
          onProgress: (p) => update(jobId, { progress: p.total ? p.frame / p.total : 0 }),
        });
      }

      await finalize();
      update(jobId, { status: "done", progress: 1, result: jobId });
    } catch (err) {
      if (jobs.get(jobId)?.status === "canceled") return;
      update(jobId, { status: "error", error: err instanceof Error ? err.message : String(err) });
    } finally {
      aborts.delete(jobId);
    }
  };

  return {
    enqueue(req) {
      ensureSetup();
      const job: RenderQueueJob = {
        jobId: makeJobId(),
        status: "queued",
        progress: 0,
        request: req,
        createdAt: Date.now(),
      };
      jobs.set(job.jobId, job);
      waiting.push(() => {
        void run(job.jobId).finally(release);
      });
      pump();
      return job;
    },

    get: (jobId) => jobs.get(jobId),
    list: () => [...jobs.values()],

    cancel(jobId) {
      const job = jobs.get(jobId);
      if (!job || job.status === "done" || job.status === "error") return;
      aborts.get(jobId)?.abort();
      update(jobId, { status: "canceled" });
    },

    async remove(jobId) {
      jobs.delete(jobId);
      listeners.delete(jobId);
      await storage.remove(jobId);
    },

    subscribe(jobId, fn) {
      let set = listeners.get(jobId);
      if (!set) {
        set = new Set();
        listeners.set(jobId, set);
      }
      set.add(fn);
      const current = jobs.get(jobId);
      if (current) fn(current);
      return () => {
        set?.delete(fn);
      };
    },

    download: (jobId) => storage.get(jobId),
  };
}

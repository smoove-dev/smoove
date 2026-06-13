import type { Readable } from "node:stream";
import type { RenderRequest, RenderStatus } from "../types.js";

/**
 * A render job tracked by the queue. Mirrors the studio-side `RenderJob` but is
 * the server's own record — the request is kept whole so the queue can re-derive
 * encoder options, and progress/result are pushed back to subscribers (the demo
 * turns those into SSE frames). `result` is an OPAQUE key (here: the jobId), not
 * a URL — building download URLs is the host's (HTTP) concern, never the kit's.
 */
export interface RenderQueueJob {
  jobId: string;
  status: RenderStatus;
  /** 0..1. */
  progress: number;
  request: RenderRequest;
  /** Storage key for the finished artifact (download via `queue.download`). */
  result?: string;
  error?: string;
  createdAt: number;
}

/**
 * The bytes of a finished render. The kit hands back a Node stream plus the
 * metadata a host needs to build a response — but it sets no headers and knows
 * nothing about HTTP. The demo's download route turns this into a `Response`.
 */
export interface StoredArtifact {
  /** A fresh readable stream of the artifact bytes. */
  read(): Readable;
  contentType: string;
  filename: string;
  size?: number;
}

/**
 * Where finished renders live. User-implementable (S3, a DB, a CDN…); the only
 * implementation the package ships is {@link createTempStorage}, which writes to
 * the server's temp dir.
 */
export interface RenderStorage {
  /**
   * Reserve a destination for a job. The renderer writes the artifact to the
   * returned `path` (it takes a file path via its `output` option); once written
   * the queue calls `finalize()` so the storage can seal/move/record it.
   */
  put(
    jobId: string,
    o: { ext: string; contentType: string; filename: string },
  ): Promise<{ path: string; finalize: () => Promise<void> }>;
  /** The finished artifact for a job, or null if absent. */
  get(jobId: string): Promise<StoredArtifact | null>;
  /** Drop a job's artifact. */
  remove(jobId: string): Promise<void>;
}

import { createReadStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RenderStorage, StoredArtifact } from "./types.js";

/**
 * The default {@link RenderStorage}: artifacts live as files under a directory
 * in the server's temp space (`os.tmpdir()/konva-motion-renders` by default).
 *
 * The renderer writes directly to the file path returned by `put()`, so this is
 * a thin shim over the filesystem — no copy on the hot path. A host that needs
 * durable/remote storage implements the `RenderStorage` contract instead.
 */
export function createTempStorage(opts: { dir?: string } = {}): RenderStorage {
  const root = opts.dir ?? join(tmpdir(), "konva-motion-renders");
  /** jobId → { path, contentType, filename } for finished artifacts. */
  const index = new Map<string, { path: string; contentType: string; filename: string }>();

  return {
    async put(jobId, o) {
      await mkdir(root, { recursive: true });
      const path = join(root, `${jobId}.${o.ext}`);
      return {
        path,
        finalize: async () => {
          index.set(jobId, { path, contentType: o.contentType, filename: o.filename });
        },
      };
    },

    async get(jobId): Promise<StoredArtifact | null> {
      const rec = index.get(jobId);
      if (!rec) return null;
      let size: number | undefined;
      try {
        size = (await stat(rec.path)).size;
      } catch {
        return null; // written record but the file vanished
      }
      return {
        read: () => createReadStream(rec.path),
        contentType: rec.contentType,
        filename: rec.filename,
        size,
      };
    },

    async remove(jobId) {
      const rec = index.get(jobId);
      if (!rec) return;
      index.delete(jobId);
      await rm(rec.path, { force: true });
    },
  };
}

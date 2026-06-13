import type { RenderBackend, RenderJob } from "@konva-motion/studio";

/**
 * The demo's HTTP `RenderBackend`. This is where ALL the client-side transport
 * lives — `@konva-motion/studio` ships only contracts + the server queue, never
 * `fetch`/`EventSource`. It POSTs the request, follows progress over SSE, and
 * hands the store a download URL when the job finishes.
 *
 * The studio store assigns its own `job.jobId`; the server assigns a separate
 * one. We key the SSE stream + cancel on the server's id and map back from the
 * studio id for `cancel`.
 */
export function createHttpRenderBackend(baseUrl = "/api/render"): RenderBackend {
  const serverIds = new Map<string, string>(); // studio jobId → server jobId
  const sources = new Map<string, EventSource>(); // studio jobId → SSE handle

  return {
    start(job, onUpdate) {
      return new Promise<Partial<RenderJob> | undefined>((resolve, reject) => {
        fetch(baseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(job),
        })
          .then((r) =>
            r.ok ? r.json() : Promise.reject(new Error(`Enqueue failed (${r.status})`)),
          )
          .then(({ jobId: serverId }: { jobId: string }) => {
            serverIds.set(job.jobId, serverId);
            const es = new EventSource(`${baseUrl}/${serverId}/events`);
            sources.set(job.jobId, es);
            const cleanup = () => {
              es.close();
              sources.delete(job.jobId);
            };
            es.onmessage = (e) => {
              const j = JSON.parse(e.data) as { status: string; progress: number };
              switch (j.status) {
                case "queued":
                case "rendering":
                  onUpdate({ status: "rendering", progress: j.progress });
                  break;
                case "done":
                  cleanup();
                  resolve({ progress: 1, result: `${baseUrl}/${serverId}/download` });
                  break;
                case "canceled":
                  cleanup();
                  resolve(undefined);
                  break;
                case "error":
                  cleanup();
                  reject(new Error("Render failed on the server"));
                  break;
              }
            };
            es.onerror = () => {
              if (es.readyState === EventSource.CLOSED) {
                cleanup();
                reject(new Error("Render stream closed"));
              }
            };
          })
          .catch(reject);
      });
    },

    cancel(jobId) {
      const serverId = serverIds.get(jobId);
      if (serverId) void fetch(`${baseUrl}/${serverId}/cancel`, { method: "POST" });
      sources.get(jobId)?.close();
    },

    download(job) {
      if (job.result) window.open(job.result, "_blank", "noopener");
    },
  };
}

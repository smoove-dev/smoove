import type { RenderBackend, RenderJob } from "@konva-motion/studio";

/**
 * Client-side MOCK render transport, injected into `<Studio render={...}>`.
 * The studio package ships no transport; this stands in for a real backend by
 * ticking progress on a timer and pushing it into the store via `onUpdate`.
 */
export function createMockRender(): RenderBackend {
  const canceled = new Set<string>();
  return {
    start(job, onUpdate) {
      return new Promise<Partial<RenderJob> | undefined>((resolve) => {
        if (job.kind === "still") {
          // stills "render" instantly
          setTimeout(() => resolve({ progress: 1, result: "blob:mock-still" }), 400);
          return;
        }
        onUpdate({ status: "rendering" });
        let progress = 0;
        const id = setInterval(() => {
          if (canceled.has(job.jobId)) {
            clearInterval(id);
            resolve(undefined);
            return;
          }
          progress += 0.04 + Math.random() * 0.08;
          if (progress >= 1) {
            clearInterval(id);
            onUpdate({ progress: 1 });
            resolve({ progress: 1, result: "blob:mock-render" });
          } else {
            onUpdate({ progress });
          }
        }, 350);
      });
    },
    cancel(jobId) {
      canceled.add(jobId);
    },
    download() {
      // mock: nothing to download; the store surfaces a toast.
    },
  };
}

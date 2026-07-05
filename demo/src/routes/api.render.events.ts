import type { RenderQueueJob } from "@smoove/studio/server";
import type { LoaderFunctionArgs } from "react-router";
import { queue } from "../server/render-queue.server.js";

const isTerminal = (s: string) => s === "done" || s === "error" || s === "canceled";

/** GET /api/render/:jobId/events — SSE stream of job state until it settles. */
export async function loader({ params, request }: LoaderFunctionArgs) {
  const jobId = params.jobId as string;
  if (!queue.get(jobId)) return new Response("Not found", { status: 404 });

  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let closed = false;
  const stream = new ReadableStream({
    start(controller) {
      const finish = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        try {
          controller.close();
        } catch {}
      };
      const onJob = (job: RenderQueueJob) => {
        if (closed) return;
        // The client can vanish between the abort/cancel callback and this
        // delivery — a throwing enqueue must not take the server down.
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(job)}\n\n`));
        } catch {
          finish();
          return;
        }
        // Defer so `unsubscribe` is assigned even when the very first (synchronous)
        // delivery is already terminal.
        if (isTerminal(job.status)) queueMicrotask(finish);
      };
      unsubscribe = queue.subscribe(jobId, onJob);
      request.signal.addEventListener("abort", finish);
    },
    // Fires when the consumer disconnects (the dev server doesn't always abort
    // `request.signal` on TCP close) — stop emitting into the dead stream.
    cancel() {
      closed = true;
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

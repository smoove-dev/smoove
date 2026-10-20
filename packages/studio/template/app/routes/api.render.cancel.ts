import type { ActionFunctionArgs } from "react-router";
import { renderOff, renderQueue } from "../server/render-queue.server.js";

/** POST /api/render/:jobId/cancel — abort an in-flight job. */
export async function action({ params }: ActionFunctionArgs) {
  const queue = await renderQueue();
  if (!queue) return renderOff();
  queue.cancel(params.jobId as string);
  return Response.json({ ok: true });
}

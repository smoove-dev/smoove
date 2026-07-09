import type { ActionFunctionArgs } from "react-router";
import { queue } from "../server/render-queue.server.js";

/** POST /api/render/:jobId/cancel — abort an in-flight job. */
export async function action({ params }: ActionFunctionArgs) {
  queue.cancel(params.jobId as string);
  return Response.json({ ok: true });
}

import type { RenderRequest } from "@smoove/studio";
import type { ActionFunctionArgs } from "react-router";
import { renderOff, renderQueue } from "../server/render-queue.server.js";

/** POST /api/render — enqueue a render, return the server-assigned job id. */
export async function action({ request }: ActionFunctionArgs) {
  const queue = await renderQueue();
  if (!queue) return renderOff();
  const req = (await request.json()) as RenderRequest;
  const job = queue.enqueue(req);
  return Response.json({ jobId: job.jobId });
}

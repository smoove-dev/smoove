import type { RenderRequest } from "@konva-motion/studio";
import type { ActionFunctionArgs } from "react-router";
import { queue } from "../server/render-queue.server.js";

/** POST /api/render — enqueue a render, return the server-assigned job id. */
export async function action({ request }: ActionFunctionArgs) {
  const req = (await request.json()) as RenderRequest;
  const job = queue.enqueue(req);
  return Response.json({ jobId: job.jobId });
}

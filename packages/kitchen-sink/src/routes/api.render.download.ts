import { Readable } from "node:stream";
import type { LoaderFunctionArgs } from "react-router";
import { queue } from "../server/render-queue.server.js";

/** GET /api/render/:jobId/download — stream the finished artifact. */
export async function loader({ params }: LoaderFunctionArgs) {
  const jobId = params.jobId as string;
  const artifact = await queue.download(jobId);
  if (!artifact) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "Content-Type": artifact.contentType,
    "Content-Disposition": `attachment; filename="${artifact.filename}"`,
  });
  if (artifact.size != null) headers.set("Content-Length", String(artifact.size));

  const body = Readable.toWeb(artifact.read()) as unknown as ReadableStream;
  return new Response(body, { headers });
}

import type { AgentInput } from "@smoove/editor";
import { createUIMessageStreamResponse, toUIMessageStream } from "ai";
import type { ActionFunctionArgs } from "react-router";
import { getAi } from "../server/ai.server.js";

/** POST /api/agent — AI SDK UI message stream for one turn. */
export async function action({ request }: ActionFunctionArgs) {
  const body = (await request.json()) as AgentInput;

  try {
    const result = await getAi().stream(body, request.signal);
    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}

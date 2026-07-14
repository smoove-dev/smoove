import { getAi } from "../server/ai.server.js";

/** GET /api/agent/models — key-free model list for the picker. */
export async function loader() {
  try {
    const ai = await getAi();
    return Response.json(ai.models());
  } catch {
    // Provider not configured yet — an empty picker is the correct UI.
    return Response.json([]);
  }
}

import { index, layout, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  layout("layouts/studio-layout.tsx", [
    index("routes/home.tsx"),
    route("c/:id", "routes/composition.tsx"),
    route("queue", "routes/queue.tsx"),
  ]),
  // The editor: its own frame, since the chat rail replaces the sidebar.
  layout("layouts/editor-layout.tsx", [route("editor", "routes/editor.tsx")]),
  // Standalone player-only page (no Studio shell) for testing <smoove-player>.
  route("player", "routes/player.tsx"),
  // Render API (resource routes — no UI). All HTTP for the render queue lives
  // here; the queue itself comes from @smoove/studio/server.
  route("api/render", "routes/api.render.ts"),
  route("api/render/:jobId/events", "routes/api.render.events.ts"),
  route("api/render/:jobId/download", "routes/api.render.download.ts"),
  route("api/render/:jobId/cancel", "routes/api.render.cancel.ts"),
  // Agent API (resource routes — no UI).
  route("api/agent", "routes/api.agent.ts"),
  route("api/agent/models", "routes/api.agent.models.ts"),
] satisfies RouteConfig;

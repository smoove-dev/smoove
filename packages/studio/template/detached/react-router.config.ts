import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "studio",
  // Server mode: the app runs a Node server so the render API (resource routes
  // under /api/render) can drive the headless renderer. The studio UI itself is
  // client-only: it server-renders an inert shell, and the <smoove-player>
  // element and the Konva stage start after hydration.
  ssr: true,
} satisfies Config;

import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "src",
  // Server mode: the app runs a Node server so the render API (resource routes
  // under /api/render) can drive the headless renderer. The studio UI itself is
  // still client-only — it SSR-renders an inert shell (the <km-player> custom
  // element and Konva stage initialize after hydration).
  ssr: true,
} satisfies Config;

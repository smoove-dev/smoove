import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "src",
  // SPA mode: the studio is canvas/custom-element/RAF-driven and client-only,
  // so there is no server render — only the root shell is prerendered to HTML.
  ssr: false,
} satisfies Config;

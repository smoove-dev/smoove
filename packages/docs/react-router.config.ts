import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "src",
  // SSR Node server: docs are rendered on the server (react-router-serve) so
  // every page ships fully-formed HTML for SEO and fast first paint.
  ssr: true,
} satisfies Config;

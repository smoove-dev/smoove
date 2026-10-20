import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("docs/*", "routes/docs.tsx"),
  route("api/search", "routes/search.ts"),
  // Plain-text routes for coding agents: an index, every page in one file,
  // and each page as Markdown.
  route("llms.txt", "routes/llms.ts"),
  route("llms-full.txt", "routes/llms-full.ts"),
  route("llms.mdx/docs/*", "routes/llms-page.ts"),
] satisfies RouteConfig;

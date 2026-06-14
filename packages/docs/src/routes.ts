import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("docs", "routes/docs.tsx", [
    index("routes/docs.index.tsx"),
    route(":slug", "routes/docs.page.tsx"),
  ]),
] satisfies RouteConfig;

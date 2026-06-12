import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("layouts/studio-layout.tsx", [
    index("routes/home.tsx"),
    route("c/:id", "routes/composition.tsx"),
    route("queue", "routes/queue.tsx"),
  ]),
] satisfies RouteConfig;

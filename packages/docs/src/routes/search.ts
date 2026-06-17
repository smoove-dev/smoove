import { createFromSource } from "fumadocs-core/search/server";
import { source } from "../lib/source";
import type { Route } from "./+types/search";

// Static search index built from the docs source. The Fumadocs SearchDialog
// (provided by RootProvider) queries this endpoint at /api/search.
const server = createFromSource(source, {
  language: "english",
});

export async function loader({ request }: Route.LoaderArgs) {
  return server.GET(request);
}

import { createFromSource } from "fumadocs-core/search/server";
import { source } from "../lib/source";

// The search index, pre-rendered to a static JSON file at /api/search. The
// browser downloads it and searches locally (see components/search-dialog.tsx),
// so no server answers queries.
const server = createFromSource(source, {
  language: "english",
});

export async function loader() {
  return server.staticGET();
}

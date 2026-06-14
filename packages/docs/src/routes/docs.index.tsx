import { redirect } from "react-router";
import { getFirstDocSlug } from "../lib/content.server";

// /docs has no page of its own — send visitors to the first doc.
export function loader() {
  const slug = getFirstDocSlug();
  return redirect(slug ? `/docs/${slug}` : "/");
}

export default function DocsIndex() {
  return null;
}

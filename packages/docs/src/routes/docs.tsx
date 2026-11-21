import browserCollections from "collections/browser";
import type { Node } from "fumadocs-core/page-tree";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { Banner } from "fumadocs-ui/components/banner";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { isRouteErrorResponse, Link, redirect, useRouteError } from "react-router";
import { useMDXComponents } from "../components/mdx";
import { baseOptions } from "../lib/layout.shared";
import { source } from "../lib/source";
import type { Route } from "./+types/docs";

export async function loader({ params }: Route.LoaderArgs) {
  const slugs = params["*"].split("/").filter((v) => v.length > 0);
  const page = source.getPage(slugs);
  if (!page) {
    // Bare `/docs` (no slug) → send the reader to the first page in the
    // sidebar (getPages() is alphabetical, which would land on "Audio").
    if (slugs.length === 0) {
      const first = firstPageUrl(source.getPageTree().children);
      if (first) throw redirect(first);
    }
    throw new Response("Not found", { status: 404 });
  }
  return {
    path: page.path,
    url: page.url,
    pageTree: await source.serializePageTree(source.getPageTree()),
  };
}

/** The URL of the first page in sidebar order. */
function firstPageUrl(nodes: Node[]): string | undefined {
  for (const node of nodes) {
    if (node.type === "page") return node.url;
    if (node.type === "folder") {
      const url = node.index?.url ?? firstPageUrl(node.children);
      if (url) return url;
    }
  }
  return undefined;
}

// MDX bodies are rendered client-side (the documented Fumadocs RR path): the
// loader ships only page metadata + the serialized tree, and this client loader
// resolves the compiled MDX for `path`.
const clientLoader = browserCollections.docs.createClientLoader({
  component({ toc, frontmatter, default: Mdx }) {
    // biome-ignore lint/correctness/useHookAtTopLevel: MDX API
    const components = useMDXComponents();

    return (
      <DocsPage toc={toc}>
        <title>{`${frontmatter.title} · smoove`}</title>
        {frontmatter.description ? (
          <meta name="description" content={frontmatter.description} />
        ) : null}
        <DocsTitle>{frontmatter.title}</DocsTitle>
        <DocsDescription>{frontmatter.description}</DocsDescription>
        <DocsBody>
          <Mdx components={components} />
        </DocsBody>
      </DocsPage>
    );
  },
});

export default function Page({ loaderData }: Route.ComponentProps) {
  const { path, pageTree } = useFumadocsLoader(loaderData);

  return (
    <>
      <Banner id="smoove-alpha">smoove is in alpha: APIs can change between releases.</Banner>
      <DocsLayout {...baseOptions()} tree={pageTree}>
        {clientLoader.useContent(path)}
      </DocsLayout>
    </>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  // The site is pre-rendered: a URL with no page also has no data file, so the
  // router reports a missing loader result instead of a 404 response.
  const is404 =
    (isRouteErrorResponse(error) && error.status === 404) ||
    (error instanceof Error && error.message.startsWith("No result found for routeId"));
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="font-semibold text-2xl">
        {is404 ? "Page not found" : "Something went wrong"}
      </h1>
      <p className="mt-3 text-fd-muted-foreground">
        {is404
          ? "That documentation page doesn’t exist (yet)."
          : "An unexpected error occurred while loading this page."}{" "}
        <Link className="text-fd-primary underline" to="/docs">
          Back to the docs
        </Link>
        .
      </p>
    </div>
  );
}

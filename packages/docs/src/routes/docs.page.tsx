import { Link, data, isRouteErrorResponse, useRouteError } from "react-router";
import {
  IconChevronLeftSm,
  IconChevronRight,
  IconChevronRightSm,
  IconEdit,
  IconInfo,
} from "../components/icons";
import { useCopyButtons } from "../components/use-copy-buttons";
import { useDemoMounts } from "../components/use-demo-mounts";
import { getDoc, getPrevNext } from "../lib/content.server";
import type { Route } from "./+types/docs.page";

const GH_EDIT = "https://github.com/konva-motion/konva-motion/edit/main/packages/docs/src/content";
const GH_ISSUE = "https://github.com/konva-motion/konva-motion/issues/new";

export function loader({ params }: Route.LoaderArgs) {
  const page = getDoc(params.slug);
  if (!page) throw data(`No doc page "${params.slug}"`, { status: 404 });
  const { prev, next } = getPrevNext(params.slug);
  return { page, prev, next };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not found · konva-motion" }];
  const { meta } = loaderData.page;
  return [
    { title: `${meta.title} · konva-motion` },
    { name: "description", content: meta.description ?? "" },
  ];
}

export default function DocPage({ loaderData }: Route.ComponentProps) {
  const { page, prev, next } = loaderData;
  // Re-wire copy buttons inside the server-rendered article on each navigation.
  useCopyButtons(page.meta.slug);
  // Mount any `:::demo <id> | …` slots with a live <km-player>.
  useDemoMounts(page.meta.slug);

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/docs">{page.meta.group}</Link>
        <IconChevronRight />
        <span className="cur">{page.meta.title}</span>
      </nav>

      <article className="prose">
        {page.meta.eyebrow && <span className="eyebrow">{page.meta.eyebrow}</span>}
        <h1>{page.meta.title}</h1>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: trusted first-party Markdown */}
        <div dangerouslySetInnerHTML={{ __html: page.html }} />
      </article>

      <footer className="page-foot">
        <nav className="page-nav" aria-label="Pagination">
          {prev ? (
            <Link className="page-nav__card page-nav__card--prev" to={`/docs/${prev.slug}`}>
              <span className="page-nav__dir">
                <IconChevronLeftSm /> Previous
              </span>
              <span className="page-nav__title">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link className="page-nav__card page-nav__card--next" to={`/docs/${next.slug}`}>
              <span className="page-nav__dir">
                <IconChevronRightSm /> Next
              </span>
              <span className="page-nav__title">{next.title}</span>
            </Link>
          ) : (
            <span />
          )}
        </nav>

        <div className="page-meta">
          <div className="page-meta__links">
            <a href={`${GH_EDIT}/${page.meta.slug}.md`} target="_blank" rel="noopener noreferrer">
              <IconEdit />
              Edit this page on GitHub
            </a>
            <a href={GH_ISSUE} target="_blank" rel="noopener noreferrer">
              <IconInfo />
              Report an issue
            </a>
          </div>
          <span>Last updated June 2026</span>
        </div>
      </footer>
    </>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const is404 = isRouteErrorResponse(error) && error.status === 404;
  return (
    <article className="prose">
      <span className="eyebrow">{is404 ? "404" : "Error"}</span>
      <h1>{is404 ? "Page not found" : "Something went wrong"}</h1>
      <p>
        {is404
          ? "That documentation page doesn’t exist (yet)."
          : "An unexpected error occurred while loading this page."}{" "}
        <Link to="/docs">Back to the docs</Link>.
      </p>
    </article>
  );
}

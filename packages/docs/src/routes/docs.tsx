import { useEffect, useState } from "react";
import { Outlet, useMatches } from "react-router";
import { DocHeader } from "../components/doc-header";
import { Sidebar } from "../components/sidebar";
import { Toc } from "../components/toc";
import { buildNav } from "../lib/content.server";
import type { Heading } from "../lib/markdown.server";
import type { Route } from "./+types/docs";

export function loader() {
  return { nav: buildNav() };
}

export default function DocsLayout({ loaderData }: Route.ComponentProps) {
  const { nav } = loaderData;
  const [navOpen, setNavOpen] = useState(false);

  // The TOC lives in the layout (3rd grid column) but its data comes from the
  // child page route — read its loader data via the match tree.
  const matches = useMatches();
  const page = matches.find((m) => m.id.endsWith("docs.page"));
  const headings =
    (page?.data as { page?: { headings?: Heading[] } } | undefined)?.page?.headings ?? [];

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  // Escape closes the drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const close = () => setNavOpen(false);

  return (
    <>
      <DocHeader onMenu={() => setNavOpen(true)} />
      <div className={navOpen ? "nav-open" : undefined}>
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: decorative scrim; Escape closes the drawer */}
        <div className="nav-scrim" onClick={close} aria-hidden="true" />
        <div className="shell">
          <Sidebar nav={nav} onNavigate={close} />
          <main className="content">
            <div className="content__inner">
              <Outlet />
            </div>
          </main>
          <Toc headings={headings} />
        </div>
      </div>
    </>
  );
}

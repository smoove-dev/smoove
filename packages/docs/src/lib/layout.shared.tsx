import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { BrandMark } from "../components/icons";

const GH_URL = "https://github.com/smoove/smoove";

// Brand lockup for the docs navbar. Self-contained (Tailwind + the BrandMark
// SVG) because the SmooveStudio `base.css` that styles the home-page `.brand` isn't
// loaded on docs routes — colors track the violet accent and Fumadocs tokens.
function Logo() {
  return (
    <>
      <span className="inline-grid size-6 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 text-white shadow-sm ring-1 ring-white/15">
        <BrandMark className="size-3.5" />
      </span>
      <span className="font-semibold text-[15px] tracking-tight">
        konva<span className="text-fd-muted-foreground">-motion</span>
      </span>
    </>
  );
}

// Shared layout options for the Fumadocs DocsLayout: logo + nav menu (mirrors the
// home header) + GitHub link.
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Logo />,
      url: "/",
    },
    githubUrl: GH_URL,
    links: [
      // { text: "Docs", url: "/docs/introduction" },
      // { text: "Components", url: "/docs/components" },
      // { text: "Examples", url: "/docs/player" },
    ],
  };
}

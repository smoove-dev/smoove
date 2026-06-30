import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { BrandMark } from "../components/icons";

const GH_URL = "https://github.com/smoove-dev/smoove";

// Brand lockup for the docs navbar. Self-contained (Tailwind + the BrandMark
// SVG) because the home-page `base.css` that styles the `.brand` lockup isn't
// loaded on docs routes. The colored (gradient) edge-dot mark is shown directly
// — no chip — per the lockup spec; the wordmark renders in the Comfortaa display
// face (var(--font-display), set in app.css). Per the size ladder the mark box
// is ~1.6× the wordmark (15px word → 24px mark = size-6).
function Logo() {
  return (
    <>
      <BrandMark className="size-6" gradient />
      <span
        className="font-bold text-[15px] tracking-tight"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Smoove
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

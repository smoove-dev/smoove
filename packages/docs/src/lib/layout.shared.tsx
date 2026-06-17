import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

const GH_URL = "https://github.com/konva-motion/konva-motion";

// Shared layout options for the Fumadocs DocsLayout (nav title, GitHub link).
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "konva-motion",
    },
    githubUrl: GH_URL,
  };
}

import type { ReactNode } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import "./styles/base.css";
import "./styles/prose.css";
import "./styles/docs.css";
import "./app.css";

export function links() {
  return [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap",
    },
  ];
}

// FOUC-safe theme init — runs before first paint so the page never flashes the
// wrong theme. Mirrors the design's inline <head> script.
const THEME_INIT = `(function(){try{var t=localStorage.getItem("km-docs-theme");if(!t)t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export function Layout({ children }: { children: ReactNode }) {
  return (
    // data-theme is rewritten by the inline script before hydration; the
    // server/client attribute mismatch on first paint is expected.
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <Meta />
        <Links />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: trusted static theme bootstrap */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function HydrateFallback() {
  return <div className="km-boot">Loading…</div>;
}

export default function Root() {
  return <Outlet />;
}

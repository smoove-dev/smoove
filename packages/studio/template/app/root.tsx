import type { CSSProperties, ReactNode } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import "@smoove/studio/styles.css";
import config from "virtual:smoove/config";
import "./app.css";

/** smoove.config.ts's primaryColor reskins the studio through its one accent variable. */
const accent = config.primaryColor
  ? ({ "--color-accent": config.primaryColor } as CSSProperties)
  : undefined;

export function links() {
  return [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Comfortaa:wght@400;500;600;700&family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap",
    },
  ];
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" style={accent}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{config.name ?? "Smoove Studio"}</title>
        <Meta />
        <Links />
      </head>
      <body>
        <div id="smoove-root">{children}</div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function HydrateFallback() {
  return <div className="smoove-boot">Loading studio…</div>;
}

export default function Root() {
  return <Outlet />;
}

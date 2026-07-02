import { RootProvider } from "fumadocs-ui/provider/react-router";
import type { ReactNode } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import "./app.css";
// Dogfood the standalone player distribution: `?url` hands us the served URL of
// the prebuilt files (self-contained ESM bundle + its stylesheet) instead of
// inlining them into the docs bundle, so the docs site loads <smoove-player> via a
// plain <script>/<link> — exactly the way a CDN consumer would.
import playerScriptUrl from "@smoove/player/standalone?url";
import playerStylesUrl from "@smoove/player/styles.css?url";

export function links() {
  return [
    { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Comfortaa:wght@400;500;600;700&family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap",
    },
    { rel: "stylesheet", href: playerStylesUrl },
  ];
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    // next-themes (via RootProvider) toggles the theme class on <html> after
    // hydration; suppress the expected first-paint attribute mismatch.
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <Meta />
        <Links />
        {/* Registers <smoove-player> + controls and pins window.Smoove / Konva.
            type="module" defers it, so element upgrade happens post-parse. */}
        <script type="module" src={playerScriptUrl} />
      </head>
      <body>
        <RootProvider theme={{ defaultTheme: "dark" }}>{children}</RootProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function HydrateFallback() {
  return <div className="smoove-boot">Loading…</div>;
}

export default function Root() {
  return <Outlet />;
}

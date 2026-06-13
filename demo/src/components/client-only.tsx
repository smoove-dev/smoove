import { type ReactNode, useEffect, useState } from "react";

/**
 * Render `children` only after hydration. The studio stage mounts a
 * `<km-player>` custom element + a Konva canvas, which can't be server-rendered
 * (the element upgrades on the client and would mismatch the SSR HTML). The
 * first client render returns `fallback` — matching the server — then swaps to
 * the real subtree once mounted.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: () => ReactNode;
  fallback?: ReactNode;
}) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return <>{hydrated ? children() : fallback}</>;
}

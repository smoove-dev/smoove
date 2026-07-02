import { type ReactNode, useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * `true` once the app has hydrated on the client; `false` during SSR and the
 * initial hydration render. Backed by `useSyncExternalStore` so the first client
 * render matches the server (no hydration warning) and flips to `true` right
 * after.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/**
 * Render `children` only after hydration. `<smoove-player>` (and any web
 * component that injects its own light-DOM chrome on `connectedCallback`)
 * mutates the very element React is about to hydrate. If the element upgrades
 * before hydration reaches it — which is exactly what the `<head>` module script
 * that registers the player causes in the production SSR build — React sees DOM
 * it never rendered, tears the element down, and recreates it. That disconnect
 * destroys the `src`-loaded composition, and the re-import hands back the same
 * (now dead) module singleton, so the player silently plays an empty stage.
 *
 * Mounting the player client-side keeps it out of the hydration pass entirely.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}): ReactNode {
  return useHydrated() ? children : fallback;
}

import { useEffect } from "react";

/**
 * Mounts `<km-player>` demos into the server-rendered article after hydration
 * and on every navigation. The mount module is dynamically imported so the
 * player's `customElements.define` side effect stays out of the SSR bundle.
 * Re-runs whenever `dep` changes (e.g. the route slug).
 */
export function useDemoMounts(dep?: unknown): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: `dep` is an explicit re-run trigger (route change), not a referenced value
  useEffect(() => {
    let cancelled = false;
    void import("../demos/mount.js").then((m) => {
      if (!cancelled) m.mountDemos();
    });
    return () => {
      cancelled = true;
    };
  }, [dep]);
}

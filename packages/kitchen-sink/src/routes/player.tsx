import type { SmoovePlayer } from "@smoove/player";
// The player registers custom elements (classes extending HTMLElement) at import
// time, so its JS can't run under SSR — it's dynamically imported in the browser
// (see PlayerStage). The stylesheet is safe to import at module scope.
import "@smoove/player/styles.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClientOnly } from "../components/client-only.js";
import registry from "../registry.js";

/**
 * A player-only page for exercising `<smoove-player>` directly, outside the
 * Studio shell. Pick any composition from the registry and it mounts into a
 * single live player with the default control bar. Lives at `/player`.
 */

// Group the registry's catalog rows into <optgroup>s, preserving registry order.
function useGroupedEntries() {
  return useMemo(() => {
    const groups: { label: string; items: { id: string; title: string }[] }[] = [];
    const byLabel = new Map<string, (typeof groups)[number]>();
    for (const e of registry.entries()) {
      const label = e.group ?? "Other";
      let group = byLabel.get(label);
      if (!group) {
        group = { label, items: [] };
        byLabel.set(label, group);
        groups.push(group);
      }
      group.items.push({ id: e.id, title: e.title ?? e.id });
    }
    return groups;
  }, []);
}

// Mounts one <smoove-player> imperatively (a client-only custom element) and
// swaps its `composition` as the selection changes — the same element persists,
// so this also exercises the player's live composition-swap path.
function PlayerStage({ id }: { id: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<SmoovePlayer | null>(null);
  const aspectRef = useRef(16 / 9);
  const [ready, setReady] = useState(false);

  // Size the player box to the composition's aspect ratio, as large as fits the
  // stage (contain), so the player never stretches the comp — a square comp gets
  // a square player. The player then fills its box edge-to-edge (no letterbox).
  const fit = useCallback(() => {
    const host = hostRef.current;
    const el = playerRef.current;
    if (!host || !el) return;
    const cw = host.clientWidth;
    const ch = host.clientHeight;
    const ar = aspectRef.current;
    let w = cw;
    let h = cw / ar;
    if (h > ch) {
      h = ch;
      w = ch * ar;
    }
    el.style.width = `${Math.round(w)}px`;
    el.style.height = `${Math.round(h)}px`;
  }, []);

  // Load the player module (browser-only), mount one <smoove-player>, and keep it
  // fitted as the stage resizes.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let el: SmoovePlayer | null = null;
    let ro: ResizeObserver | null = null;
    import("@smoove/player").then(() => {
      if (disposed || !hostRef.current) return;
      el = document.createElement("smoove-player") as SmoovePlayer;
      el.setAttribute("controls", "");
      el.setAttribute("loop", "");
      el.className = "km-player-el";
      hostRef.current.appendChild(el);
      playerRef.current = el;
      ro = new ResizeObserver(() => fit());
      ro.observe(hostRef.current);
      setReady(true);
    });
    return () => {
      disposed = true;
      ro?.disconnect();
      if (el) {
        el.composition = null;
        el.remove();
      }
      playerRef.current = null;
    };
  }, [fit]);

  // Swap in the selected composition once the player is ready, and on every change.
  // Its intrinsic size drives the player's aspect ratio.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    registry.load(id).then((comp) => {
      if (cancelled || !playerRef.current) return;
      playerRef.current.composition = comp;
      const w = comp.width();
      const h = comp.height();
      if (w > 0 && h > 0) aspectRef.current = w / h;
      fit();
    });
    return () => {
      cancelled = true;
    };
  }, [id, ready, fit]);

  return <div ref={hostRef} className="km-player-stage" />;
}

export default function PlayerPage() {
  const groups = useGroupedEntries();
  const [id, setId] = useState(() => registry.entries()[0]?.id ?? "");

  return (
    <div className="km-player-page">
      <header className="km-player-bar">
        <label className="km-player-pick">
          <span>Composition</span>
          <select value={id} onChange={(e) => setId(e.target.value)}>
            {groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {/* Crosses the studio-shell boundary, so a full navigation (fresh
            Studio mount) is intentional here. */}
        <a href="/" className="km-player-link">
          Studio →
        </a>
      </header>
      <main className="km-player-main">
        <ClientOnly fallback={<div className="km-player-fallback">Loading player…</div>}>
          {() => <PlayerStage id={id} />}
        </ClientOnly>
      </main>
    </div>
  );
}

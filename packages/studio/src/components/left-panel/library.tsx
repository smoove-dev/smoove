import { useMemo, useState } from "react";
import { useStudio } from "../../hooks/use-studio.js";
import { useSignalValue } from "../../signals/signal-bridge.js";
import type { RegistryEntry } from "../../types.js";
import { Icon } from "../icon/icon.js";
import { SidebarGroup } from "./sidebar-group.js";
import { SidebarItem } from "./sidebar-item.js";

/** Auto-grouped, searchable composition list — the convenient default. */
export function Library({
  heading = "Compositions",
  searchPlaceholder = "Search compositions…",
  search = true,
}: {
  heading?: string;
  searchPlaceholder?: string;
  /** Show the search field (set false to omit it). */
  search?: boolean;
}) {
  const store = useStudio();
  const selectedId = useSignalValue(store.selectedId);
  useSignalValue(store.loadStatus); // re-render the sub-labels as comps load
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();

  const groups = useMemo(() => {
    const map = new Map<string, RegistryEntry[]>();
    for (const e of store.entries) {
      const g = e.group ?? "Compositions";
      const list = map.get(g) ?? [];
      list.push(e);
      map.set(g, list);
    }
    return [...map.entries()].map(([group, items]) => ({ group, items }));
  }, [store.entries]);

  const subFor = (id: string): string | undefined => {
    const c = store.registry.peek(id);
    if (!c) return undefined;
    return `${(c.durationInFrames.get() / c.fps).toFixed(1)}s · ${c.fps}fps`;
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto scroll px-2 pt-1.5 pb-6">
      {search && (
        <div className="relative mx-1 mt-1.5 mb-3">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3">
            <Icon name="search" size={15} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-bg-2 border border-line rounded-control text-[12.5px] text-ink-1 placeholder:text-ink-3 pl-8 pr-2.5 py-[7px] outline-none focus:border-line-2"
          />
        </div>
      )}

      <div className="text-[10px] font-bold tracking-[.1em] uppercase text-ink-3 px-2.5 pt-2.5 pb-1.5">
        {heading}
      </div>
      {groups.map(({ group, items }) => {
        const filtered = items.filter(
          (d) =>
            !ql || (d.title ?? d.id).toLowerCase().includes(ql) || group.toLowerCase().includes(ql),
        );
        if (ql && filtered.length === 0) return null;
        return (
          <SidebarGroup
            key={group}
            label={group}
            count={items.length}
            defaultOpen={false}
            forceOpen={ql ? true : undefined}
          >
            {filtered.map((d) => {
              const active = d.id === selectedId;
              return (
                <SidebarItem
                  key={d.id}
                  active={active}
                  title={d.title ?? d.id}
                  sub={subFor(d.id)}
                  dot={active}
                  onClick={() => store.select(d.id)}
                />
              );
            })}
          </SidebarGroup>
        );
      })}
    </div>
  );
}

import { useMemo, useState } from "react";
import { useStudio } from "../../hooks/use-studio.js";
import { useSignalValue } from "../../signals/signal-bridge.js";
import type { RegistryEntry } from "../../types.js";
import { Icon } from "../icon/icon.js";
import { SidebarGroup } from "./sidebar-group.js";
import { SidebarItem } from "./sidebar-item.js";

/** Searchable composition catalog — ungrouped rows first, then named groups. */
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
  const status = useSignalValue(store.loadStatus); // re-render rows as comps load
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();

  // Ungrouped entries render as a flat list; entries with a `group` collapse
  // under that heading. Order is preserved from the registry.
  const { flat, groups } = useMemo(() => {
    const flat: RegistryEntry[] = [];
    const map = new Map<string, RegistryEntry[]>();
    for (const e of store.entries) {
      if (e.group) {
        const list = map.get(e.group) ?? [];
        list.push(e);
        map.set(e.group, list);
      } else {
        flat.push(e);
      }
    }
    return { flat, groups: [...map.entries()].map(([group, items]) => ({ group, items })) };
  }, [store.entries]);

  const match = (e: RegistryEntry, group?: string): boolean =>
    !ql ||
    (e.title ?? e.id).toLowerCase().includes(ql) ||
    (e.tags ?? []).some((t) => t.toLowerCase().includes(ql)) ||
    (group ?? "").toLowerCase().includes(ql);

  const flatHits = flat.filter((e) => match(e));
  const groupHits = groups
    .map((g) => ({ ...g, items: g.items.filter((e) => match(e, g.group)) }))
    .filter((g) => g.items.length > 0);

  const total = flat.length + groups.reduce((n, g) => n + g.items.length, 0);
  const empty = flatHits.length === 0 && groupHits.length === 0;

  const renderItem = (e: RegistryEntry) => {
    const active = e.id === selectedId;
    const loading = status[e.id] === "loading";
    return (
      <SidebarItem
        key={e.id}
        active={active}
        title={e.title ?? e.id}
        dot={active && !loading}
        loading={loading}
        onClick={() => store.select(e.id)}
      />
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {search && (
        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3">
              <Icon name="search" size={15} />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-control border border-line bg-bg-2 pl-8 pr-2.5 py-[7px] text-[12.5px] text-ink-1 outline-none transition-colors placeholder:text-ink-3 focus:border-accent-line"
            />
          </div>
        </div>
      )}

      <div className="scroll min-h-0 flex-1 overflow-y-auto px-2 pb-6">
        <div className="flex items-center justify-between px-2 pt-1 pb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[.12em] text-ink-3">
            {heading}
          </span>
          <span className="font-mono text-[10px] text-ink-3">{total}</span>
        </div>

        {empty ? (
          <div className="px-2 py-8 text-center text-[12px] text-ink-3">
            No compositions match “{q.trim()}”
          </div>
        ) : (
          <>
            {flatHits.map(renderItem)}
            {groupHits.map(({ group, items }) => (
              <SidebarGroup
                key={group}
                label={group}
                count={items.length}
                defaultOpen
                forceOpen={ql ? true : undefined}
              >
                {items.map(renderItem)}
              </SidebarGroup>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

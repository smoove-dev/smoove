import { useState } from "react";
import { Icon } from "./Icon.js";
import { KM_DEMOS } from "./catalog.js";

export function Sidebar({
  activeId,
  onSelect,
}: {
  activeId: string;
  onSelect: (id: string) => void;
}) {
  // On mount (i.e. reload), collapse every group except the one holding the
  // active demo, so you land focused on what's playing.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const activeGroup = KM_DEMOS.find((g) => g.items.some((d) => d.id === activeId))?.group;
    return new Set(KM_DEMOS.filter((g) => g.group !== activeGroup).map((g) => g.group));
  });
  const [q, setQ] = useState("");

  const toggle = (g: string) =>
    setCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });

  const ql = q.trim().toLowerCase();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Icon name="spark" size={13} style={{ color: "#fff" }} />
        </div>
        <div className="brand-name">
          <b>Km</b>
          <span>Studio</span>
        </div>
        <div className="brand-tag">v0.4</div>
      </div>
      <div className="library scroll">
        <div className="lib-search">
          <Icon name="search" size={15} />
          <input placeholder="Search demos…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {KM_DEMOS.map((group) => {
          const items = group.items.filter(
            (d) =>
              !ql || d.title.toLowerCase().includes(ql) || group.group.toLowerCase().includes(ql),
          );
          if (ql && items.length === 0) return null;
          const isCol = collapsed.has(group.group) && !ql;
          return (
            <div key={group.group} className={`group${isCol ? " collapsed" : ""}`}>
              <button type="button" className="group-head" onClick={() => toggle(group.group)}>
                <span className="group-chevron">
                  <Icon name="chevron" size={14} />
                </span>
                {group.group}
                <span className="group-count">{group.items.length}</span>
              </button>
              <div className="group-items">
                <div>
                  {items.map((d) => {
                    const active = d.id === activeId;
                    return (
                      <button
                        type="button"
                        key={d.id}
                        className={`demo-row${active ? " active" : ""}`}
                        onClick={() => onSelect(d.id)}
                      >
                        <span className="demo-ico">
                          <Icon name={group.icon} size={15} />
                        </span>
                        <span className="demo-meta">
                          <div className="demo-title">{d.title}</div>
                          <div className="demo-sub">
                            {(d.durationInFrames / d.fps).toFixed(1)}s · {d.fps}fps
                          </div>
                        </span>
                        {active && <span className="demo-dot" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink } from "react-router";
import type { NavGroup } from "../lib/content.server";
import { Brand } from "./brand";
import { DocIcon, IconClose, IconExternal, IconGithub, IconSearch } from "./icons";

interface ExtraLink {
  label: string;
  href: string;
  icon: string;
  external?: boolean;
}

// Community links live below the content-driven nav. Static — they don't map to
// Markdown pages.
const COMMUNITY: ExtraLink[] = [
  {
    label: "GitHub",
    href: "https://github.com/konva-motion/konva-motion",
    icon: "github",
    external: true,
  },
  { label: "Discord", href: "https://discord.gg/konva-motion", icon: "discord", external: true },
];

function matches(text: string, q: string) {
  return !q || text.toLowerCase().includes(q);
}

export function Sidebar({ nav, onNavigate }: { nav: NavGroup[]; onNavigate: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();

  // "/" focuses search, Escape clears it (ported from site.js).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const tag = active?.tagName;
      if (e.key === "/" && active !== inputRef.current && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape" && active === inputRef.current) {
        setQuery("");
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(
    () =>
      nav
        .map((g) => ({
          ...g,
          items: g.items.filter((it) => matches(it.title, q) || matches(g.label, q)),
        }))
        .filter((g) => g.items.length > 0),
    [nav, q],
  );

  const communityVisible = COMMUNITY.filter((l) => matches(l.label, q));
  const nothing = filtered.length === 0 && communityVisible.length === 0;

  return (
    <aside className="sidebar" aria-label="Documentation navigation">
      <div className="sidebar__drawer-head">
        <Brand />
        <span className="doc-header__spacer" />
        <button
          type="button"
          className="icon-btn"
          onClick={onNavigate}
          aria-label="Close navigation"
        >
          <IconClose />
        </button>
      </div>

      <div className="sidebar__head">
        <div className="sidebar__search">
          <IconSearch />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search docs…"
            aria-label="Search documentation"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="kbd-hint">/</span>
        </div>
      </div>

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: delegated link-close for mobile drawer */}
      <nav className="sidebar__nav scroll" onClick={onNavigate}>
        {filtered.map((group) => (
          <div className="nav-group" key={group.label}>
            <div className="nav-group__label">{group.label}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.slug}
                to={`/docs/${item.slug}`}
                className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}
              >
                <span className="ic">
                  <DocIcon name={item.icon} />
                </span>
                {item.title}
              </NavLink>
            ))}
          </div>
        ))}

        {communityVisible.length > 0 && (
          <div className="nav-group">
            <div className="nav-group__label">Community</div>
            {communityVisible.map((link) => (
              <a
                key={link.label}
                className="nav-link"
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
              >
                <span className="ic">
                  {link.icon === "github" ? <IconGithub /> : <DocIcon name={link.icon} />}
                </span>
                {link.label}
                {link.external && (
                  <span className="tag">
                    <IconExternal style={{ width: 13, height: 13, color: "var(--ink-3)" }} />
                  </span>
                )}
              </a>
            ))}
          </div>
        )}

        {nothing && (
          <div className="nav-empty" style={{ display: "block" }}>
            No pages match your search.
          </div>
        )}
      </nav>
    </aside>
  );
}

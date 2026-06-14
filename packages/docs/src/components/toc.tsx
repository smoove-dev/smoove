import { useEffect, useState } from "react";
import type { Heading } from "../lib/markdown.server";

export function Toc({ headings }: { headings: Heading[] }) {
  const [active, setActive] = useState<string>(headings[0]?.id ?? "");

  // Scroll-spy: highlight the heading nearest the top of the viewport. Ported
  // from the design's IntersectionObserver logic.
  useEffect(() => {
    if (headings.length === 0) return;
    setActive(headings[0]?.id ?? "");
    const visible = new Map<string, number>();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target.id, e.boundingClientRect.top);
          else visible.delete(e.target.id);
        }
        if (visible.size === 0) return;
        let top: string | null = null;
        let ty = Number.POSITIVE_INFINITY;
        visible.forEach((y, id) => {
          if (y < ty) {
            ty = y;
            top = id;
          }
        });
        if (top) setActive(top);
      },
      { rootMargin: "-12% 0px -72% 0px", threshold: [0, 1] },
    );
    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [headings]);

  if (headings.length === 0) return <aside className="toc scroll" aria-label="On this page" />;

  return (
    <aside className="toc scroll" aria-label="On this page">
      <div className="toc__title">On this page</div>
      <ul className="toc__list">
        {headings.map((h) => (
          <li className={`toc__item toc__item--h${h.level}`} key={h.id}>
            <a
              href={`#${h.id}`}
              className={h.id === active ? "is-active" : undefined}
              onClick={() => setActive(h.id)}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

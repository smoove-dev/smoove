import { useEffect } from "react";

function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  }
  fallbackCopy(text);
  return Promise.resolve();
}

function fallbackCopy(text: string) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {
    // ignore
  }
  document.body.removeChild(ta);
}

/**
 * Wires copy buttons that live inside server-rendered HTML (`.code-block__copy`
 * within an article set via dangerouslySetInnerHTML, and `[data-copy]` buttons).
 * Ported from the design's site.js; re-runs whenever `dep` changes (e.g. route
 * navigation) so freshly rendered blocks get listeners.
 */
export function useCopyButtons(dep?: unknown) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: `dep` is an explicit re-run trigger (route change), not a referenced value
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    const flash = (btn: HTMLElement, label?: HTMLElement | null) => {
      btn.classList.add("is-copied");
      const prev = label?.textContent ?? "";
      if (label) label.textContent = "Copied";
      const t = setTimeout(() => {
        btn.classList.remove("is-copied");
        if (label) label.textContent = prev;
      }, 1600);
      cleanups.push(() => clearTimeout(t));
    };

    for (const btn of Array.from(document.querySelectorAll<HTMLElement>(".code-block__copy"))) {
      const handler = () => {
        const code = btn.closest(".code-block")?.querySelector("code");
        if (!code) return;
        copyText((code as HTMLElement).innerText).then(() =>
          flash(btn, btn.querySelector<HTMLElement>(".copy-label")),
        );
      };
      btn.addEventListener("click", handler);
      cleanups.push(() => btn.removeEventListener("click", handler));
    }

    for (const btn of Array.from(document.querySelectorAll<HTMLElement>("[data-copy]"))) {
      const handler = () => {
        copyText(btn.getAttribute("data-copy") ?? "").then(() => flash(btn));
      };
      btn.addEventListener("click", handler);
      cleanups.push(() => btn.removeEventListener("click", handler));
    }

    return () => {
      for (const fn of cleanups) fn();
    };
  }, [dep]);
}

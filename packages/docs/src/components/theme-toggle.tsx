import { IconMoon, IconSun } from "./icons";

// Theme is bootstrapped before paint by the inline script in root.tsx; this just
// flips the attribute + persists the choice. The sun/moon swap is CSS-driven.
function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  const next = cur === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem("km-docs-theme", next);
  } catch {
    // ignore storage failures (private mode, etc.)
  }
}

export function ThemeToggle() {
  return (
    <button
      type="button"
      className="icon-btn theme-toggle"
      onClick={toggleTheme}
      aria-label="Toggle color theme"
      title="Toggle theme"
    >
      <IconSun className="sun" />
      <IconMoon className="moon" />
    </button>
  );
}

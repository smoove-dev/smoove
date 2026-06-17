import { useTheme } from "next-themes";
import { IconMoon, IconSun } from "./icons";

// Theme is managed by next-themes (via RootProvider in root.tsx), which toggles
// the `.light` / `.dark` class on <html>. The sun/moon swap is CSS-driven.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      className="icon-btn theme-toggle"
      onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
      aria-label="Toggle color theme"
      title="Toggle theme"
    >
      <IconSun className="sun" />
      <IconMoon className="moon" />
    </button>
  );
}

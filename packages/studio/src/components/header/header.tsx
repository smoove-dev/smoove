import type { ReactNode } from "react";
import { useStudio } from "../../hooks/use-studio.js";
import { cn } from "../../lib/cn.js";
import { useSignalValue } from "../../signals/signal-bridge.js";
import { IconButton } from "../button/icon-button.js";

/**
 * Top bar container. Below the wide layout it also carries the buttons that
 * open the library (left) and the inspector (right), when the studio has them,
 * so a host composing the header doesn't add them itself.
 */
export function Header({ children, className }: { children: ReactNode; className?: string }) {
  const store = useStudio();
  const band = useSignalValue(store.band);
  const sidebars = useSignalValue(store.sidebars);
  const panels = useSignalValue(store.panels);
  const libraryOpen = useSignalValue(store.libraryOpen);
  const libraryCollapsed = useSignalValue(store.libraryCollapsed);
  const panelOpen = useSignalValue(store.panelOpen);
  const narrow = band === "narrow";

  const libraryButton =
    band !== "wide" && sidebars > 0 ? (
      <IconButton
        icon="panelLeft"
        size="sm"
        tone="bordered"
        aria-label={narrow ? "Open library" : libraryCollapsed ? "Show library" : "Hide library"}
        title={narrow ? "Library" : libraryCollapsed ? "Show library" : "Hide library"}
        active={narrow ? libraryOpen : !libraryCollapsed}
        onClick={() =>
          narrow ? store.setLibraryOpen(true) : store.setLibraryCollapsed(!libraryCollapsed)
        }
      />
    ) : null;
  const panelButton =
    band !== "wide" && panels > 0 ? (
      <IconButton
        icon="panelRight"
        size="sm"
        tone="bordered"
        aria-label="Open inspector"
        title="Inspector"
        active={panelOpen}
        onClick={() => store.setPanelOpen(true)}
      />
    ) : null;

  return (
    <header
      className={cn(
        "flex items-center flex-none bg-bg-1 border-b border-line h-14",
        narrow ? "gap-2 px-2" : "gap-3 px-4",
        className,
      )}
    >
      {libraryButton}
      {children}
      {panelButton}
    </header>
  );
}

import { useStudio } from "../../hooks/use-studio.js";
import { ZOOM_STEPS } from "../../lib/constants.js";
import { useSignalValue } from "../../signals/signal-bridge.js";
import { Icon } from "../icon/icon.js";
import { MenuItem, MenuSeparator, StMenu } from "../primitives/menu.js";

/** Zoom control: Fit + 25–200% steps (Base UI Menu). */
export function Zoom() {
  const store = useStudio();
  const zoom = useSignalValue(store.zoom);
  const fitScale = useSignalValue(store.fitScale);
  const shown = zoom === "fit" ? Math.round(fitScale * 100) : Math.round(zoom * 100);

  const trigger = (
    <button
      type="button"
      className="flex items-center gap-1.5 bg-bg-2 border border-line rounded-ui text-[12px] font-semibold text-ink-1 pl-3 pr-2 py-2 hover:bg-bg-3 hover:border-line-2 data-[popup-open]:bg-bg-3 outline-none"
    >
      <span className="font-mono min-w-[32px]">{shown}%</span>
      <span className="text-ink-3">
        <Icon name="chevron" size={13} />
      </span>
    </button>
  );

  return (
    <StMenu trigger={trigger} side="bottom" align="end">
      <MenuItem selected={zoom === "fit"} onClick={() => store.setZoom("fit")}>
        Fit to size
      </MenuItem>
      <MenuSeparator />
      {ZOOM_STEPS.map((z) => (
        <MenuItem key={z} selected={zoom === z} onClick={() => store.setZoom(z)}>
          {z === 1 ? "100%" : `${z * 100}%`}
        </MenuItem>
      ))}
    </StMenu>
  );
}

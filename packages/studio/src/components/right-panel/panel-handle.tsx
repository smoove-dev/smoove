import { useStudio } from "../../hooks/use-studio.js";
import { Icon } from "../icon/icon.js";

/** The collapsed right-panel rail. */
export function PanelHandle() {
  const store = useStudio();
  return (
    <div className="w-[26px] flex-none bg-bg-1 border-l border-line flex flex-col items-center pt-3 gap-3.5">
      <button
        type="button"
        onClick={() => store.setPanelOpen(true)}
        className="size-[26px] grid place-items-center text-ink-3 rounded-[6px] hover:text-ink-1 hover:bg-bg-2"
        title="Open panel"
      >
        <Icon name="panelRight" size={16} />
      </button>
      <button
        type="button"
        onClick={() => store.setPanelOpen(true)}
        className="[writing-mode:vertical-rl] text-[10.5px] font-bold tracking-[.12em] uppercase text-ink-3 hover:text-ink-2 mt-1"
      >
        Inspector
      </button>
    </div>
  );
}

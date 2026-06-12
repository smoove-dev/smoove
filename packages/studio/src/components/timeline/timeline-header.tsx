import { useComposition } from "../../hooks/use-composition.js";
import { usePlayback } from "../../hooks/use-playback.js";
import { useRealFps } from "../../hooks/use-real-fps.js";
import { useStudio } from "../../hooks/use-studio.js";
import { cn } from "../../lib/cn.js";
import { fmtTime, fpsHealth } from "../../lib/format.js";
import { useSignalValue } from "../../signals/signal-bridge.js";
import type { TlMode } from "../../store/store.js";
import { Button } from "../button/button.js";
import { Icon } from "../icon/icon.js";
import type { IconName } from "../icon/paths.js";

/** Module-level so it isn't remounted each frame while the header re-renders. */
function ModeButton({
  id,
  icon,
  label,
  active,
  onClick,
}: {
  id: TlMode;
  icon: IconName;
  label: string;
  active: boolean;
  onClick: (id: TlMode) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={cn(
        "flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-[5px] rounded-[6px]",
        active
          ? "bg-bg-0 text-ink-1 shadow-[0_1px_4px_rgba(0,0,0,.3)]"
          : "text-ink-3 hover:text-ink-1",
      )}
    >
      <Icon name={icon} size={14} className={active ? "text-accent-2" : ""} /> {label}
    </button>
  );
}

/** Timeline header: mode toggle + loop region tools + resolution/fps/frame readout. */
export function TimelineHeader() {
  const store = useStudio();
  const tlMode = useSignalValue(store.tlMode);
  const tlZoom = useSignalValue(store.timelineZoom);
  const region = useSignalValue(store.region);
  const { player, frame, total, fps } = usePlayback();
  const realFps = useRealFps();
  const { composition } = useComposition();

  const w = composition?.width() ?? 1280;
  const h = composition?.height() ?? 720;
  const den = Math.max(1, total - 1);
  const regionActive = region.in != null || region.out != null;
  const inSec = (region.in ?? 0) / fps;
  const outSec = (region.out ?? den) / fps;
  const health = fpsHealth(realFps, fps);
  const curFps = realFps ? Math.min(realFps, fps) : null;

  return (
    <div className="flex items-center gap-3.5 h-[42px] flex-none px-3 border-b border-line">
      <div className="flex bg-bg-2 border border-line rounded-ui p-[3px] gap-0.5">
        <ModeButton
          id="progress"
          icon="progress"
          label="Progress"
          active={tlMode === "progress"}
          onClick={store.setTlMode}
        />
        <ModeButton
          id="layered"
          icon="layers"
          label="Timeline"
          active={tlMode === "layered"}
          onClick={store.setTlMode}
        />
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          tone="default"
          icon="markIn"
          onClick={() => player && store.setRegionIn(player.getCurrentFrame())}
          title="Set loop start (I)"
        >
          In
        </Button>
        <Button
          size="sm"
          tone="default"
          icon="markOut"
          onClick={() => player && store.setRegionOut(player.getCurrentFrame())}
          title="Set loop end (O)"
        >
          Out
        </Button>
        {regionActive ? (
          <span className="flex items-center gap-1.5 font-mono text-[11.5px] text-ink-1 bg-accent-soft border border-accent/35 rounded-full pl-3 pr-1 py-[3px]">
            {fmtTime(inSec)}
            <span className="text-ink-3">–</span>
            {fmtTime(outSec)}
            <span className="text-accent-2 text-[10.5px] pl-1">{(outSec - inSec).toFixed(1)}s</span>
            <button
              type="button"
              onClick={store.clearRegion}
              className="size-[18px] grid place-items-center rounded-full text-ink-2 hover:bg-white/12 hover:text-white"
            >
              <Icon name="close" size={12} />
            </button>
          </span>
        ) : (
          <span className="text-[11.5px] text-ink-3 italic">No loop region</span>
        )}
      </div>

      <div className="flex-1" />

      {tlMode === "layered" && (
        <>
          <div className="flex items-center h-[26px] bg-bg-2 border border-line rounded-control overflow-hidden">
            <button
              type="button"
              onClick={() => store.setTimelineZoom(tlZoom / 1.5)}
              className="w-[24px] h-full grid place-items-center text-ink-3 hover:bg-bg-3 hover:text-ink-1"
              title="Zoom out"
            >
              <Icon name="minus" size={13} />
            </button>
            <button
              type="button"
              onClick={() => store.setTimelineZoom(1)}
              className="h-full px-1.5 min-w-[40px] text-center font-mono text-[10.5px] text-ink-2 hover:text-ink-1 border-x border-line tabular-nums"
              title="Reset zoom"
            >
              {Math.round(tlZoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => store.setTimelineZoom(tlZoom * 1.5)}
              className="w-[24px] h-full grid place-items-center text-ink-3 hover:bg-bg-3 hover:text-ink-1"
              title="Zoom in"
            >
              <Icon name="plus" size={13} />
            </button>
          </div>
          <span className="w-px h-[15px] bg-line-2" />
        </>
      )}

      <div className="flex items-center gap-2.5 font-mono text-[11.5px] text-ink-2 tabular-nums">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="layout" size={12} className="text-ink-3" />
          {w}
          <span className="text-ink-3">×</span>
          {h}
        </span>
        <span className="w-px h-[15px] bg-line-2" />
        <span
          className={cn(
            "inline-flex items-center gap-1 font-semibold",
            health === "good" && "text-good",
            health === "ok" && "text-warn",
            health === "low" && "text-danger",
          )}
        >
          <span className="inline-block text-right" style={{ minWidth: "2ch" }}>
            {curFps == null ? "—" : curFps}
          </span>
          <span className="text-ink-3">/</span>
          <span className="text-ink-2">{fps}</span>
          <i className="not-italic text-[9.5px] text-ink-3 ml-0.5">fps</i>
        </span>
        <span className="w-px h-[15px] bg-line-2" />
        <span className="inline-flex items-center gap-1">
          <Icon name="camera" size={12} className="text-ink-3" />
          <span
            className="text-ink-1 inline-block text-right"
            style={{ minWidth: `${String(total).length}ch` }}
          >
            {frame}
          </span>
          <span className="text-ink-3">/</span>
          {total}
          <i className="not-italic text-[9.5px] text-ink-3 ml-0.5">f</i>
        </span>
      </div>
    </div>
  );
}

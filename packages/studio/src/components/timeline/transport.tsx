import { usePlayback } from "../../hooks/use-playback.js";
import { useStudio } from "../../hooks/use-studio.js";
import { cn } from "../../lib/cn.js";
import { fmtTime } from "../../lib/format.js";
import { useSignalValue } from "../../signals/signal-bridge.js";
import { IconButton } from "../button/icon-button.js";
import { StSlider } from "../primitives/slider.js";
import { StTooltip } from "../primitives/tooltip.js";

/** Transport bar: play/step, volume, time, loop, fullscreen. */
export function Transport({ className }: { className?: string }) {
  const store = useStudio();
  const { player, playing, loop, volume, muted, fullscreen, durSec, timeSec } = usePlayback();
  const region = useSignalValue(store.region);
  const regionActive = region.in != null || region.out != null;

  return (
    <div className={cn("flex items-center gap-1 px-3 h-[50px] flex-none", className)}>
      <StTooltip content="Restart">
        <IconButton size="sm" icon="prev" onClick={() => player?.seekTo(region.in ?? 0)} />
      </StTooltip>
      <StTooltip content={playing ? "Pause (Space)" : "Play (Space)"}>
        <IconButton
          icon={playing ? "pause" : "play"}
          iconSize={20}
          className="text-white"
          onClick={() => player?.toggle()}
        />
      </StTooltip>
      <StTooltip content="Step forward (→)">
        <IconButton size="sm" icon="next" onClick={() => player?.stepBy(1)} />
      </StTooltip>

      <div className="flex items-center group ml-1">
        <StTooltip content={muted ? "Unmute" : "Mute"}>
          <IconButton
            size="sm"
            icon={muted || volume === 0 ? "mute" : "volume"}
            onClick={() => player?.setMuted(!muted)}
          />
        </StTooltip>
        <div className="w-0 group-hover:w-[78px] overflow-hidden transition-[width] flex items-center">
          <StSlider
            value={muted ? 0 : Math.round(volume * 100)}
            min={0}
            max={100}
            className="w-[70px] mx-1"
            onValueChange={(v) => {
              player?.setVolume(v / 100);
              player?.setMuted(v === 0);
            }}
          />
        </div>
      </div>

      <div className="font-mono text-[12.5px] text-ink-2 ml-2 whitespace-nowrap tracking-tight">
        <span className="text-ink-1">{fmtTime(timeSec)}</span>
        <span className="text-ink-3 mx-0.5">/</span>
        {fmtTime(durSec)}
      </div>

      <div className="flex-1" />

      <StTooltip content={loop ? `Looping ${regionActive ? "region" : "playback"}` : "Loop off"}>
        <IconButton
          size="sm"
          icon="loop"
          active={loop}
          onClick={() => player?.toggleLoop()}
          className="relative"
        >
          {regionActive && (
            <span className="absolute top-1 right-1 size-1.5 rounded-full bg-accent-2 shadow-[0_0_6px_var(--color-accent-soft)]" />
          )}
        </IconButton>
      </StTooltip>
      <StTooltip content={fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}>
        <IconButton
          size="sm"
          icon={fullscreen ? "fullscreenExit" : "fullscreen"}
          onClick={() => player?.toggleFullscreen()}
        />
      </StTooltip>
    </div>
  );
}

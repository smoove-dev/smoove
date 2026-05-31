import type { Composition } from "@konva-motion/core";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon.js";
import { useSignal } from "./useSignal.js";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const fmt = (s: number) => {
  const t = Math.max(0, s);
  const m = Math.floor(t / 60);
  const sec = Math.floor(t % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

/** YouTube-style transport bar driven by the live Composition signals. */
export function Player({
  comp,
  fs,
  onFs,
}: {
  comp: Composition;
  fs: boolean;
  onFs: () => void;
}) {
  const fps = comp.fps;
  const frame = useSignal(comp.frame);
  const total = useSignal(comp.durationInFrames);
  const playing = useSignal(comp.isPlaying);
  const loop = useSignal(comp.loop);
  const vol = useSignal(comp.mixer.volume);
  const muted = useSignal(comp.mixer.muted);

  const time = frame / fps;
  const dur = total / fps;
  const pct = total > 1 ? clamp01(frame / (total - 1)) : 0;

  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const wasPlaying = useRef(false);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const seekPct = (p: number) => comp.setFrame(Math.round(clamp01(p) * (total - 1)));
  const posFromEvent = (e: MouseEvent | React.MouseEvent) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return 0;
    return clamp01((e.clientX - r.left) / r.width);
  };

  useEffect(() => {
    if (!drag) return;
    const pos = (e: MouseEvent) => {
      const r = trackRef.current?.getBoundingClientRect();
      if (!r) return 0;
      return clamp01((e.clientX - r.left) / r.width);
    };
    const move = (e: MouseEvent) => comp.setFrame(Math.round(pos(e) * (total - 1)));
    const up = () => {
      setDrag(false);
      if (wasPlaying.current) comp.play();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [drag, total, comp]);

  const togglePlay = () => {
    if (playing) comp.pause();
    else comp.play();
  };

  return (
    <div className="player">
      <div
        className={`scrub${drag ? " dragging" : ""}`}
        ref={trackRef}
        onMouseDown={(e) => {
          wasPlaying.current = playing;
          comp.pause();
          setDrag(true);
          seekPct(posFromEvent(e));
        }}
        onMouseMove={(e) => setHoverX(posFromEvent(e))}
        onMouseLeave={() => setHoverX(null)}
      >
        <div className="scrub-track">
          {hoverX != null && <div className="scrub-hover" style={{ width: `${hoverX * 100}%` }} />}
          <div className="scrub-fill" style={{ width: `${pct * 100}%` }} />
          <div className="scrub-knob" style={{ left: `${pct * 100}%` }} />
        </div>
        {hoverX != null && (
          <div className="scrub-tip" style={{ left: `${hoverX * 100}%` }}>
            {fmt(hoverX * dur)}
          </div>
        )}
      </div>
      <div className="controls">
        <button
          type="button"
          className="ctrl sm"
          title="Previous (restart)"
          onClick={() => comp.setFrame(0)}
        >
          <Icon name="prev" size={18} />
        </button>
        <button
          type="button"
          className="ctrl play"
          title={playing ? "Pause (space)" : "Play (space)"}
          onClick={togglePlay}
        >
          <Icon name={playing ? "pause" : "play"} size={20} />
        </button>
        <button
          type="button"
          className="ctrl sm"
          title="Step forward"
          onClick={() => comp.setFrame(Math.min(total - 1, frame + 1))}
        >
          <Icon name="next" size={18} />
        </button>
        <div className="vol">
          <button
            type="button"
            className="ctrl sm"
            title={muted ? "Unmute" : "Mute"}
            onClick={() => comp.mixer.setMuted(!muted)}
          >
            <Icon name={muted || vol === 0 ? "mute" : "volume"} size={18} />
          </button>
          <div className="vol-slider">
            <input
              className="vol-range"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={muted ? 0 : vol}
              onChange={(e) => {
                const v = Number(e.target.value);
                comp.mixer.setVolume(v);
                comp.mixer.setMuted(v === 0);
              }}
            />
          </div>
        </div>
        <div className="time">
          <span className="cur">{fmt(time)}</span>
          <span className="sep">/</span>
          {fmt(dur)}
        </div>
        <div className="spacer" />
        <button
          type="button"
          className={`ctrl sm${loop ? " on" : ""}`}
          title="Loop"
          onClick={() => comp.setLoop(!loop)}
        >
          <Icon name="loop" size={18} />
        </button>
        <button
          type="button"
          className="ctrl sm"
          title={fs ? "Exit fullscreen" : "Fullscreen"}
          onClick={onFs}
        >
          <Icon name={fs ? "fullscreenExit" : "fullscreen"} size={18} />
        </button>
      </div>
    </div>
  );
}

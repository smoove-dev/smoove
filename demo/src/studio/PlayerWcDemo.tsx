import { Composition, Sequence } from "@konva-motion/core";
import "@konva-motion/player";
import "@konva-motion/player/styles.css";
import Konva from "konva";
import { useEffect, useRef, useState } from "react";

const W = 640;
const H = 360;
const TOTAL = 90;

/**
 * Build a self-contained 16:9 composition. No container needed — core creates
 * a detached one in the browser, and `<km-player>` re-parents the stage into
 * its own canvas host via `setContainer` when assigned.
 */
function buildComposition(): Composition {
  const comp = new Composition({
    id: "wc-demo",
    fps: 30,
    durationInFrames: TOTAL,
    width: W,
    height: H,
  });
  const main = new Sequence({ from: 0, durationInFrames: TOTAL });
  main.add(new Konva.Rect({ x: 0, y: 0, width: W, height: H, fill: "#0d1117" }));

  const ball = new Konva.Circle({ x: 80, y: H / 2, radius: 36, fill: "#ff5d8f" });
  const label = new Konva.Text({
    x: 0,
    y: H - 40,
    width: W,
    align: "center",
    text: "km-player",
    fontSize: 22,
    fontFamily: "system-ui, sans-serif",
    fill: "#8b949e",
  });
  main.add(ball);
  main.add(label);
  comp.add(main);

  main.register((frame) => {
    const t = frame / (TOTAL - 1); // 0..1
    ball.x(80 + t * (W - 160));
    ball.y(H / 2 + Math.sin(t * Math.PI * 4) * (H / 2 - 50));
    ball.fill(`hsl(${Math.round(t * 320)}, 80%, 62%)`);
  });

  return comp;
}

/** Demo page exercising the @konva-motion/player web components. */
export function PlayerWcDemo() {
  // biome-ignore lint/suspicious/noExplicitAny: custom-element ref needs the `.composition` property setter.
  const playerRef = useRef<any>(null);
  const [log, setLog] = useState<string[]>([]);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    const comp = buildComposition();
    const el = playerRef.current;
    if (!el) return;
    el.composition = comp;

    const push = (line: string) => setLog((l) => [line, ...l].slice(0, 8));
    const events = [
      "play",
      "pause",
      "ended",
      "seeked",
      "ratechange",
      "volumechange",
      "mutechange",
      "fullscreenchange",
      "scalechange",
    ];
    const handlers = events.map((name) => {
      const fn = (e: Event) => push(`${name} ${JSON.stringify((e as CustomEvent).detail)}`);
      el.addEventListener(name, fn);
      return [name, fn] as const;
    });

    return () => {
      for (const [name, fn] of handlers) el.removeEventListener(name, fn);
      comp.destroy(); // the demo owns this composition
    };
  }, []);

  const applyRate = (r: number) => {
    setRate(r);
    playerRef.current?.setPlaybackRate(r);
    if (!playerRef.current?.isPlaying()) playerRef.current?.play();
  };

  return (
    <div style={{ padding: 32, background: "#0c0c0f", minHeight: "100%", color: "#ececf0" }}>
      <h2 style={{ font: "600 18px system-ui", marginTop: 0 }}>
        @konva-motion/player — web component
      </h2>

      <div
        style={{
          width: 720,
          maxWidth: "100%",
          aspectRatio: "16 / 9",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <km-player ref={playerRef} controls loop autoplay style={{ width: "100%", height: "100%" }}>
          <km-player-overlay>
            <km-player-play-button size="large" />
          </km-player-overlay>
          <km-player-controls>
            <km-player-controls-row>
              <km-player-progress />
            </km-player-controls-row>
            <km-player-controls-row>
              <km-player-play-toggle-button />
              <km-player-sound-control collapsed />
              <km-player-time />
              <km-player-space grow />
              <km-player-loop-button />
              <km-player-fullscreen-button />
            </km-player-controls-row>
          </km-player-controls>
        </km-player>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
        <span style={{ fontSize: 13, opacity: 0.7 }}>playbackRate:</span>
        {[-1, 0.5, 1, 2].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => applyRate(r)}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: "1px solid #2a2a31",
              background: rate === r ? "#5b8cff" : "#1c1c21",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {r}×
          </button>
        ))}
      </div>

      <pre
        style={{
          marginTop: 16,
          padding: 12,
          background: "#111",
          borderRadius: 8,
          fontSize: 12,
          minHeight: 120,
          color: "#9fb6ff",
        }}
      >
        {log.join("\n") || "events will appear here…"}
      </pre>
    </div>
  );
}

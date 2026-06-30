import { useEffect, useRef, useState } from "react";
import { Demo, type SmoovePlayerEl } from "./demo";

// Must match CardProps in src/demos/dynamic-props.ts.
const DEFAULTS = { headline: "Parametrized video", accent: "#38bdf8", rating: 4 };

// An interactive companion for the Dynamic props page: the standard <Demo>
// player for the dynamic-props composition, plus form controls in its footer
// that push new props with `player.setProps`. Editing a field updates the scene
// on the next frame (or immediately while paused), which is the whole point of
// the props signal.
export function PropsPlayground() {
  const playerRef = useRef<SmoovePlayerEl | null>(null);
  const [headline, setHeadline] = useState(DEFAULTS.headline);
  const [accent, setAccent] = useState(DEFAULTS.accent);
  const [rating, setRating] = useState(DEFAULTS.rating);

  // Push the current form state into the composition. Safe to call before the
  // composition mounts (the player no-ops until it has one), so we also apply on
  // `loaded` to catch whatever the user has already typed.
  useEffect(() => {
    playerRef.current?.setProps({ headline, accent, rating });
  }, [headline, accent, rating]);

  useEffect(() => {
    const el = playerRef.current;
    if (!el) return;
    const apply = () => el.setProps({ headline, accent, rating });
    el.addEventListener("loaded", apply);
    return () => el.removeEventListener("loaded", apply);
  }, [headline, accent, rating]);

  const form = (
    <form
      className="flex flex-wrap items-end gap-4 px-4 py-3 text-fd-foreground text-sm"
      onSubmit={(e) => e.preventDefault()}
    >
      <label className="flex flex-1 flex-col gap-1" style={{ minWidth: "12rem" }}>
        <span className="font-medium text-fd-muted-foreground text-xs">Headline</span>
        <input
          type="text"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          className="rounded-md border border-fd-border bg-fd-background px-2 py-1"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-medium text-fd-muted-foreground text-xs">Accent</span>
        <input
          type="color"
          value={accent}
          onChange={(e) => setAccent(e.target.value)}
          className="h-8 w-12 cursor-pointer rounded-md border border-fd-border bg-fd-background"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-medium text-fd-muted-foreground text-xs">Rating: {rating}</span>
        <input
          type="range"
          min={0}
          max={5}
          step={1}
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="w-32 cursor-pointer"
        />
      </label>
    </form>
  );

  return (
    <Demo
      name="dynamic-props"
      label="edit the fields; the video updates live"
      initialframe={90}
      playerRef={playerRef}
      footer={form}
    />
  );
}

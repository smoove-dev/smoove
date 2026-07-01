import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { BrandMark } from "./icons";

// Minimal slice of the <smoove-player> imperative API we drive from the overlay and
// expose to callers (e.g. a footer panel that pushes props).
export interface SmoovePlayerEl extends HTMLElement {
  toggle(): void;
  isPlaying(): boolean;
  setProps(props: Record<string, unknown>): void;
}

// Every demo composition lives at `src/demos/<name>.ts` and default-exports a
// `Composition` (see `doc/authoring-demos.md`). These two globs resolve both
// views of each file from its name — the served `?comp-url` the player
// `import()`s (a compiled standalone module; see @smoove/vite), and the `?raw`
// source for the "View source" toggle — so a page only writes `<Demo
// name="orbit" />` instead of wiring two imports by hand.
const URLS = import.meta.glob("../demos/*.ts", {
  query: "?comp-url",
  import: "default",
  eager: true,
}) as Record<string, string>;
const SOURCES = import.meta.glob("../demos/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

// `../demos/orbit.ts` → `orbit`
const basename = (path: string) => path.slice(path.lastIndexOf("/") + 1).replace(/\.ts$/, "");

const DEMOS: Record<string, { url: string; source: string }> = {};
for (const [path, url] of Object.entries(URLS)) {
  const name = basename(path);
  const source = SOURCES[path];
  if (source !== undefined) DEMOS[name] = { url, source };
}

// Live-demo embed: plays a composition in <smoove-player> and offers a "View source"
// toggle that reveals it in a runtime-highlighted code block. Pass `name` to
// resolve both the player URL and the source from `src/demos/<name>.ts`, or pass
// `src`/`source` explicitly to override (e.g. a composition outside src/demos).
// Pass `children` (control markup like `<smoove-player-controls>`) to render custom
// controls inside the player instead of the default bar; the page documents the
// markup itself in a code block, so the "View source" toggle is then suppressed.
export function Demo({
  name,
  src,
  source,
  lang = "ts",
  label,
  children,
  footer,
  initialframe,
  playerRef: externalPlayerRef,
}: {
  name?: string;
  src?: string;
  source?: string;
  lang?: string;
  label?: string;
  children?: ReactNode;
  // Extra content rendered inside the figure below the player (e.g. a form that
  // drives the composition via the exposed player element).
  footer?: ReactNode;
  // Frame to paint on mount, before play. Useful when a static first frame
  // should already show the revealed scene.
  initialframe?: number;
  // Optional caller-owned ref to the <smoove-player> element, populated alongside
  // the internal one so a footer can call its imperative API.
  playerRef?: React.MutableRefObject<SmoovePlayerEl | null>;
}) {
  const [showSource, setShowSource] = useState(false);
  const playerRef = useRef<SmoovePlayerEl | null>(null);
  const setPlayerRef = (el: SmoovePlayerEl | null) => {
    playerRef.current = el;
    if (externalPlayerRef) externalPlayerRef.current = el;
  };
  const [playing, setPlaying] = useState(false);

  // Track playback so the logo play-overlay shows only while paused. The player
  // emits bubbling `play`/`pause`/`ended` CustomEvents (see smoove-player.ts).
  useEffect(() => {
    const el = playerRef.current;
    if (!el) return;
    const onPlay = () => setPlaying(true);
    const onStop = () => setPlaying(false);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onStop);
    el.addEventListener("ended", onStop);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onStop);
      el.removeEventListener("ended", onStop);
    };
  }, []);

  const resolved = name ? DEMOS[name] : undefined;
  if (name && !resolved) {
    throw new Error(
      `[docs] <Demo name="${name}" /> — no demo at src/demos/${name}.ts. Available: ${
        Object.keys(DEMOS).sort().join(", ") || "(none)"
      }`,
    );
  }
  const custom = Boolean(children);
  const playerSrc = src ?? resolved?.url;
  const playerSource = source ?? (custom ? undefined : resolved?.source);

  return (
    <figure className="not-prose my-6 overflow-hidden rounded-xl border border-fd-border bg-fd-card">
      <figcaption className="flex items-center gap-2 border-fd-border border-b px-4 py-2 text-fd-muted-foreground text-xs">
        <span className="inline-block size-1.5 rounded-full bg-fd-primary" aria-hidden="true" />
        <span className="font-medium">Live demo</span>
        <span className="ml-auto flex items-center gap-3">
          {label ? <span className="opacity-70">{label}</span> : null}
          {playerSource ? (
            <button
              type="button"
              onClick={() => setShowSource((v) => !v)}
              aria-expanded={showSource}
              className="rounded-md px-2 py-1 font-medium text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
            >
              {showSource ? "Hide source" : "View source"}
            </button>
          ) : null}
        </span>
      </figcaption>

      <div className="relative grid aspect-video w-full place-items-center bg-fd-secondary [&_smoove-player]:size-full">
        <smoove-player
          ref={setPlayerRef as React.Ref<HTMLElement>}
          src={playerSrc}
          key={name}
          controls={custom ? undefined : true}
          initialframe={initialframe}
          loop
        >
          {children}
        </smoove-player>
        {custom ? null : (
          <button
            type="button"
            aria-label="Play"
            onClick={() => playerRef.current?.toggle()}
            className={`absolute inset-0 grid place-items-center transition-opacity duration-200 ${
              playing ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
          >
            <span className="grid size-16 place-items-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur-sm transition-transform hover:scale-105">
              <BrandMark className="size-8" />
            </span>
          </button>
        )}
      </div>

      {footer ? <div className="border-fd-border border-t">{footer}</div> : null}

      {playerSource && showSource ? (
        <div className="border-fd-border border-t [&_figure]:my-0 [&_figure]:rounded-none [&_figure]:border-x-0 [&_figure]:border-b-0">
          <DynamicCodeBlock lang={lang} code={playerSource} />
        </div>
      ) : null}
    </figure>
  );
}

import type { Composition } from "@konva-motion/core";
import "@konva-motion/player";
import { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Player } from "./Player.js";
import { PlayerWcDemo } from "./PlayerWcDemo.js";
import { PanelHandle, type PanelTab, RightPanel } from "./RightPanel.js";
import { Sidebar } from "./Sidebar.js";
import { FIRST_DEMO_ID, KM_FLAT, type StudioDemo, findDemo } from "./catalog.js";
import { useComposition } from "./useComposition.js";
import { useSignal } from "./useSignal.js";

type PropValues = Record<string, unknown>;
type KmPlayerEl = HTMLElement & { composition: Composition | null };

function StageStatus({
  comp,
  title,
  w,
  h,
}: {
  comp: Composition;
  title: string;
  w: number;
  h: number;
}) {
  const frame = useSignal(comp.frame);
  const total = useSignal(comp.durationInFrames);
  return (
    <div className="stage-status">
      <b>{title}</b> · {w}×{h} ·{" "}
      <span>
        {frame}
        <span style={{ opacity: 0.5 }}>/{total}f</span>
      </span>
    </div>
  );
}

function Studio({ demo }: { demo: StudioDemo }) {
  const navigate = useNavigate();

  // Per-demo prop values, seeded from each demo's schema defaults. Kept across
  // demo switches so edits persist while the shell stays mounted.
  const [valuesByDemo, setValuesByDemo] = useState<Record<string, PropValues>>(() => {
    const seed: Record<string, PropValues> = {};
    for (const d of KM_FLAT) seed[d.id] = d.defaults;
    return seed;
  });
  const values = valuesByDemo[demo.id] ?? demo.defaults;

  const { comp, applyProps } = useComposition(demo, values);

  // Editing props pushes into the live signal (no rebuild → frame preserved).
  const onChangeProps = (next: PropValues) => {
    setValuesByDemo((s) => ({ ...s, [demo.id]: next }));
    applyProps(next);
  };
  const onResetProps = () => {
    setValuesByDemo((s) => ({ ...s, [demo.id]: demo.defaults }));
    applyProps(demo.defaults);
  };

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("props");
  const [fs, setFs] = useState(false);

  // Hand the live composition to the <km-player>, which mounts it and
  // letterbox-scales it to fill the stage — no manual fit math needed.
  const playerRef = useRef<KmPlayerEl | null>(null);
  useEffect(() => {
    if (playerRef.current) playerRef.current.composition = comp ?? null;
  }, [comp]);

  const frameW = comp ? comp.width() : demo.width;
  const frameH = comp ? comp.height() : demo.height;

  // keyboard shortcuts act on the live composition (km-player keyboard is off)
  useEffect(() => {
    if (!comp) return;
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.code === "Space") {
        e.preventDefault();
        if (comp.isPlaying.get()) comp.pause();
        else comp.play();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        comp.setFrame(Math.min(comp.durationInFrames.get() - 1, comp.frame.get() + 1));
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        comp.setFrame(Math.max(0, comp.frame.get() - 1));
      } else if (e.key === "f") {
        setFs((v) => !v);
      } else if (e.key === "l") {
        comp.setLoop(!comp.loop.get());
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [comp]);

  return (
    <div className={`app${fs ? " isFs" : ""}`}>
      <Sidebar activeId={demo.id} onSelect={(id) => navigate(`/${id}`)} />
      <div className="main">
        <div className="stage-wrap">
          <div className="stage-center">
            {/* The player owns scaling/letterbox; the studio supplies its own
                control bar below, so km-player renders no controls. */}
            <km-player ref={playerRef} class="studio-player" no-keyboard="" no-click-to-play="" />
          </div>
          {!fs && comp && <StageStatus comp={comp} title={demo.title} w={frameW} h={frameH} />}
        </div>
        {comp ? (
          <Player comp={comp} fs={fs} onFs={() => setFs((v) => !v)} />
        ) : (
          <div className="player" />
        )}
      </div>
      {!fs && (
        <div className="panel-host">
          {panelOpen ? (
            <RightPanel
              tab={panelTab}
              setTab={setPanelTab}
              onClose={() => setPanelOpen(false)}
              demo={demo}
              value={values}
              onChange={onChangeProps}
              onReset={onResetProps}
            />
          ) : (
            <PanelHandle onOpen={() => setPanelOpen(true)} />
          )}
        </div>
      )}
    </div>
  );
}

function StudioRoute() {
  const { demoId } = useParams();
  const demo = findDemo(demoId);
  if (!demo) return <Navigate to={`/${FIRST_DEMO_ID}`} replace />;
  // No key: keep the shell (and Sidebar scroll / UI state) mounted across demo
  // switches. useComposition rebuilds the Composition when `demo` changes.
  return <Studio demo={demo} />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/${FIRST_DEMO_ID}`} replace />} />
      <Route path="/player" element={<PlayerWcDemo />} />
      <Route path="/:demoId" element={<StudioRoute />} />
      <Route path="*" element={<Navigate to={`/${FIRST_DEMO_ID}`} replace />} />
    </Routes>
  );
}

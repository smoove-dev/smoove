import type { Composition } from "@konva-motion/core";
import { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Player } from "./Player.js";
import { PlayerWcDemo } from "./PlayerWcDemo.js";
import { PanelHandle, type PanelTab, RightPanel } from "./RightPanel.js";
import { Sidebar } from "./Sidebar.js";
import { ZoomControl, type ZoomMode } from "./ZoomControl.js";
import { FIRST_DEMO_ID, KM_FLAT, type StudioDemo, findDemo } from "./catalog.js";
import { useComposition } from "./useComposition.js";
import { useSignal } from "./useSignal.js";

type PropValues = Record<string, unknown>;

const PAD = 48;

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

  const { containerRef, comp, applyProps } = useComposition(demo, values);

  // Editing props pushes into the live signal (no rebuild → frame preserved).
  const onChangeProps = (next: PropValues) => {
    setValuesByDemo((s) => ({ ...s, [demo.id]: next }));
    applyProps(next);
  };
  const onResetProps = () => {
    setValuesByDemo((s) => ({ ...s, [demo.id]: demo.defaults }));
    applyProps(demo.defaults);
  };

  const [zoom, setZoom] = useState<ZoomMode>("fit");
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("props");
  const [fs, setFs] = useState(false);

  // fit scaling — observe the stage wrapper
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((ents) => {
      const r = ents[0]?.contentRect;
      if (r) setBox({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const frameW = comp ? comp.width() : demo.width;
  const frameH = comp ? comp.height() : demo.height;
  // "Fit to size" scales down to fit but never enlarges past 100%.
  const rawFit = box.w ? Math.min((box.w - PAD * 2) / frameW, (box.h - PAD * 2) / frameH) : 0.5;
  const fitScale = Math.min(1, Math.max(0.05, rawFit));
  const scale = zoom === "fit" ? fitScale : zoom;
  const overflowScroll =
    zoom !== "fit" && (frameW * scale > box.w - 8 || frameH * scale > box.h - 8);

  // keyboard shortcuts act on the live composition
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
        <div className="stage-wrap" ref={wrapRef}>
          {!fs && <ZoomControl mode={zoom} fitPct={fitScale} onSet={setZoom} />}
          <div
            className="stage-center"
            style={overflowScroll ? { overflow: "auto", placeItems: "safe center" } : undefined}
          >
            <div className="video-frame" style={{ width: frameW * scale, height: frameH * scale }}>
              <div
                className="video-scale"
                style={{
                  width: frameW,
                  height: frameH,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                <div className="video-stage" ref={containerRef} />
              </div>
            </div>
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

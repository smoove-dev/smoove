import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon.js";

export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export type ZoomMode = "fit" | number;

export function ZoomControl({
  mode,
  fitPct,
  onSet,
}: {
  mode: ZoomMode;
  fitPct: number;
  onSet: (m: ZoomMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const shown = mode === "fit" ? Math.round(fitPct * 100) : Math.round(mode * 100);

  return (
    <div className={`zoom${open ? " open" : ""}`} ref={ref}>
      <button type="button" className="zoom-btn" onClick={() => setOpen((o) => !o)}>
        <span className="pct">{shown}%</span>
        <span className="chev">
          <Icon name="chevron" size={13} />
        </span>
      </button>
      {open && (
        <div className="zoom-menu">
          <button
            type="button"
            className={`zoom-item${mode === "fit" ? " sel" : ""}`}
            onClick={() => {
              onSet("fit");
              setOpen(false);
            }}
          >
            <span className="lbl">Fit to size</span>
            <span className="check">
              <Icon name="check" size={14} />
            </span>
          </button>
          <div className="zoom-sep" />
          {ZOOM_STEPS.map((z) => (
            <button
              type="button"
              key={z}
              className={`zoom-item${mode === z ? " sel" : ""}`}
              onClick={() => {
                onSet(z);
                setOpen(false);
              }}
            >
              <span className="lbl">{z === 1 ? "100%" : `${z * 100}%`}</span>
              {mode === z ? (
                <span className="check">
                  <Icon name="check" size={14} />
                </span>
              ) : (
                <span className="val">{z === 1 ? "actual" : ""}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

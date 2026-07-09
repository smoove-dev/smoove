import { type ReactNode, useEffect, useState } from "react";
import { useComposition } from "../../hooks/use-composition.js";
import { useStudio } from "../../hooks/use-studio.js";
import { cn } from "../../lib/cn.js";
import { estMB, FORMATS, prettyMB, QUALITY } from "../../lib/constants.js";
import { fmtTime } from "../../lib/format.js";
import { useSignalValue } from "../../signals/signal-bridge.js";
import { Button } from "../button/button.js";
import { Icon } from "../icon/icon.js";
import { StDialog } from "../primitives/dialog.js";
import { DialogField } from "../primitives/dialog-field.js";
import { StNumberField } from "../primitives/number-field.js";
import { StSelect } from "../primitives/select.js";

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <DialogField label={label}>{children}</DialogField>
);

/** Server-render dialog (mocked): format/quality/resolution/fps/range → enqueue. */
export function RenderDialog({
  open,
  onOpenChange,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired after a job is enqueued (e.g. to navigate to the queue). */
  onSubmitted?: () => void;
}) {
  const store = useStudio();
  const { composition: comp, entry } = useComposition();
  const region = useSignalValue(store.region);

  const compFps = comp?.fps ?? 30;
  const total = comp ? comp.durationInFrames.get() : 0;
  const baseW = comp?.width() ?? 1280;
  const baseH = comp?.height() ?? 720;
  const durSec = total / compFps;

  const [format, setFormat] = useState("mp4");
  const [quality, setQuality] = useState("standard");
  const [w, setW] = useState(baseW);
  const [h, setH] = useState(baseH);
  const [rfps, setRfps] = useState(compFps);
  const [range, setRange] = useState<"full" | "region">("full");
  const hasRegion = region.in != null || region.out != null;

  // Output stays locked to the source aspect ratio: editing one dimension
  // recomputes the other so exports never distort the composition.
  const aspect = baseW / baseH;

  useEffect(() => {
    if (open) {
      setRfps(compFps);
      setRange("full");
      setW(baseW);
      setH(baseH);
    }
  }, [open, compFps, baseW, baseH]);

  const clampDim = (val: number) => Math.max(16, Math.min(7680, Math.round(val || 0)));
  const editW = (val: number) => {
    const nw = clampDim(val);
    setW(nw);
    setH(clampDim(nw / aspect));
  };
  const editH = (val: number) => {
    const nh = clampDim(val);
    setH(nh);
    setW(clampDim(nh * aspect));
  };

  const den = Math.max(1, total - 1);
  const inFrame = region.in ?? 0;
  const outFrame = region.out ?? den;
  const rangeDurSec = range === "region" && hasRegion ? (outFrame - inFrame) / compFps : durSec;
  const frames = Math.max(1, Math.round(rangeDurSec * rfps));
  const qf = QUALITY.find((q) => q.value === quality)?.f ?? 0.16;
  const mul = FORMATS.find((x) => x.value === format)?.mul ?? 1;
  const mb = estMB(w, h, frames, qf, mul);

  const title = entry?.title ?? entry?.id ?? "Composition";

  const submit = () => {
    store.startRender({
      id: store.selectedId.get(),
      kind: "video",
      comp: title,
      // The live props drive the preview; send them so the render matches it.
      props: comp?.props.get(),
      format,
      quality,
      w,
      h,
      fps: rfps,
      frames,
      ...(range === "region" && hasRegion ? { from: inFrame, to: outFrame } : {}),
      rangeLabel:
        range === "region" && hasRegion
          ? `${fmtTime(inFrame / compFps)}–${fmtTime(outFrame / compFps)}`
          : `Full · ${fmtTime(durSec)}`,
      sizeEst: mb,
    });
    onOpenChange(false);
    onSubmitted?.();
  };

  const D = StDialog;
  return (
    <D open={open} onOpenChange={onOpenChange}>
      <D.Popup width={500}>
        <D.Header icon="server" title="Render on server" />
        <D.Body>
          <div className="flex items-center gap-3 p-3 bg-bg-2 border border-line rounded-ui mb-4.5">
            <span className="size-8 flex-none grid place-items-center rounded-ui bg-bg-1 border border-line text-accent-2">
              <Icon name="film" size={15} />
            </span>
            <div className="min-w-0">
              <div className="text-[13.5px] font-bold text-ink-1 truncate">{title}</div>
              <div className="text-[11px] text-ink-3 font-mono mt-0.5 truncate">
                {entry?.group ?? "Compositions"} · {durSec.toFixed(1)}s source
              </div>
            </div>
          </div>
          <Field label="Format">
            <StSelect value={format} onValueChange={setFormat} options={FORMATS} />
          </Field>
          <Field label="Quality">
            <StSelect value={quality} onValueChange={setQuality} options={QUALITY} />
          </Field>
          <DialogField label="Resolution" description="Aspect ratio locked to the source.">
            <div className="flex items-center gap-2.5">
              <StNumberField value={w} onValueChange={editW} suffix="W" min={16} max={7680} />
              <span className="text-ink-3 flex-none">
                <Icon name="close" size={12} />
              </span>
              <StNumberField value={h} onValueChange={editH} suffix="H" min={16} max={7680} />
            </div>
          </DialogField>
          <Field label="Frame rate">
            <StNumberField
              value={rfps}
              onValueChange={(v) => setRfps(Math.max(1, Math.min(120, v)))}
              suffix="fps"
              min={1}
              max={120}
            />
          </Field>
          {hasRegion && (
            <Field label="Range">
              <div className="flex bg-bg-2 border border-transparent rounded-control p-[3px] gap-[3px]">
                <button
                  type="button"
                  onClick={() => setRange("full")}
                  className={cn(
                    "flex-1 text-[12px] font-semibold py-[7px] rounded-[5px] transition-colors",
                    range === "full"
                      ? "bg-bg-0 text-ink-1 shadow-[0_1px_4px_rgba(0,0,0,.3)]"
                      : "text-ink-3 hover:text-ink-1",
                  )}
                >
                  Full
                </button>
                <button
                  type="button"
                  onClick={() => setRange("region")}
                  className={cn(
                    "flex-1 text-[12px] font-semibold py-[7px] rounded-[5px] transition-colors",
                    range === "region"
                      ? "bg-bg-0 text-ink-1 shadow-[0_1px_4px_rgba(0,0,0,.3)]"
                      : "text-ink-3 hover:text-ink-1",
                  )}
                >
                  Loop region
                </button>
              </div>
            </Field>
          )}
        </D.Body>
        <D.Footer>
          <div className="flex items-center gap-1.5 font-mono text-[11.5px] text-ink-2 whitespace-nowrap">
            <Icon name="film" size={13} className="text-ink-3" />
            <span>
              {frames.toLocaleString()} frames · ~{prettyMB(mb)}
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <D.Close render={<Button tone="ghost">Cancel</Button>} />
            <Button tone="primary" icon="server" onClick={submit}>
              Render
            </Button>
          </div>
        </D.Footer>
      </D.Popup>
    </D>
  );
}

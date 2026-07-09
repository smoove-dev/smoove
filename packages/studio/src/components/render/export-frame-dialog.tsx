import { type ReactNode, useEffect, useState } from "react";
import { useComposition } from "../../hooks/use-composition.js";
import { usePlayback } from "../../hooks/use-playback.js";
import { useStudio } from "../../hooks/use-studio.js";
import { estFrameMB } from "../../lib/constants.js";
import { fmtTime } from "../../lib/format.js";
import { Button } from "../button/button.js";
import { Icon } from "../icon/icon.js";
import { StDialog } from "../primitives/dialog.js";
import { DialogField } from "../primitives/dialog-field.js";
import { StSelect } from "../primitives/select.js";

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <DialogField label={label}>{children}</DialogField>
);

const FMTS = [
  { value: "png", label: "PNG · lossless" },
  { value: "jpg", label: "JPEG · compact" },
  { value: "webp", label: "WebP" },
];

/** Export the current frame as a still (mocked). */
export function ExportFrameDialog({
  open,
  onOpenChange,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired after the still is enqueued. */
  onSubmitted?: () => void;
}) {
  const store = useStudio();
  const { composition: comp, entry } = useComposition();
  const { frame, fps } = usePlayback();
  const [format, setFormat] = useState("png");
  const [scale, setScale] = useState("1");
  const [preview, setPreview] = useState<string | null>(null);

  const baseW = comp?.width() ?? 1280;
  const baseH = comp?.height() ?? 720;
  const factor = Number(scale);
  const w = Math.round(baseW * factor);
  const h = Math.round(baseH * factor);
  const timeSec = frame / (fps || 30);
  const title = entry?.title ?? entry?.id ?? "Composition";

  // Capture the exact frame that will be exported so the preview thumbnail is
  // the real still, not a placeholder. Re-runs whenever the dialog opens or the
  // frame/props change while it's open (the composition draws live).
  // biome-ignore lint/correctness/useExhaustiveDependencies: we do need this to be changed every frame, if the frame chagnes the preview should be changed
  useEffect(() => {
    if (!open || !comp) {
      setPreview(null);
      return;
    }
    try {
      setPreview(comp.captureCanvas().toDataURL("image/png"));
    } catch {
      setPreview(null);
    }
  }, [open, comp, frame]);

  // Fit the thumbnail to the composition's aspect ratio (max 148×100).
  const aspect = baseW / baseH;
  const previewW = Math.round(Math.min(148, 100 * aspect));
  const previewH = Math.round(previewW / aspect);

  const SCALES = [
    { value: "1", label: `1× · ${baseW}×${baseH}` },
    { value: "2", label: `2× · ${baseW * 2}×${baseH * 2}` },
    { value: "3", label: `3× · ${baseW * 3}×${baseH * 3}` },
  ];

  const submit = () => {
    store.exportFrame({
      id: store.selectedId.get(),
      kind: "still",
      comp: title,
      // Capture the live props so the exported frame matches the preview.
      props: comp?.props.get(),
      format,
      quality: "frame",
      w,
      h,
      fps,
      frames: 1,
      frameNo: frame,
      rangeLabel: `Frame ${frame}`,
      sizeEst: estFrameMB(w, h, format),
    });
    onOpenChange(false);
    onSubmitted?.();
  };

  const D = StDialog;
  return (
    <D open={open} onOpenChange={onOpenChange}>
      <D.Popup width={440}>
        <D.Header icon="camera" title="Export frame" />
        <D.Body>
          <div className="flex gap-3.5 items-center mb-4.5">
            <div className="relative flex-none">
              <div
                className="rounded-ui overflow-hidden grid place-items-center bg-bg-2 shadow-[0_0_0_1px_var(--color-line-2)_inset]"
                style={{ width: previewW, height: previewH }}
              >
                {preview ? (
                  <img
                    src={preview}
                    alt="Current frame"
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <Icon name="camera" size={26} style={{ color: "rgba(255,255,255,.35)" }} />
                )}
              </div>
              <div className="absolute bottom-1.5 right-1.5 font-mono text-[9.5px] text-white bg-black/60 rounded px-1.5">
                {fmtTime(timeSec)} · #{frame}
              </div>
            </div>
            <p className="text-[12px] leading-relaxed text-ink-3 m-0 flex-1">
              Captures the composition exactly at the current playhead position.
            </p>
          </div>
          <Field label="Format">
            <StSelect value={format} onValueChange={setFormat} options={FMTS} />
          </Field>
          <Field label="Scale">
            <StSelect value={scale} onValueChange={setScale} options={SCALES} />
          </Field>
        </D.Body>
        <D.Footer>
          <div className="flex items-center gap-1.5 font-mono text-[11.5px] text-ink-2">
            <Icon name="camera" size={13} className="text-ink-3" />
            <span>
              Frame {frame} · {fmtTime(timeSec)}
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <D.Close render={<Button tone="ghost">Cancel</Button>} />
            <Button tone="primary" icon="download" onClick={submit}>
              Export still
            </Button>
          </div>
        </D.Footer>
      </D.Popup>
    </D>
  );
}

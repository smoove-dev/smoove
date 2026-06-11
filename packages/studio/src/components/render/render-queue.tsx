import { useStudio } from "../../hooks/use-studio.js";
import { cn } from "../../lib/cn.js";
import { prettyMB } from "../../lib/constants.js";
import { useSignalValue } from "../../signals/signal-bridge.js";
import type { RenderStatus } from "../../types.js";
import { Button } from "../button/button.js";
import { IconButton } from "../button/icon-button.js";
import { Icon } from "../icon/icon.js";
import type { IconName } from "../icon/paths.js";
import { StTooltip } from "../primitives/tooltip.js";

const STATUS: Record<RenderStatus, { label: string; icon: IconName; cls: string }> = {
  queued: { label: "Queued", icon: "clock", cls: "text-ink-2 bg-bg-2 border-line" },
  rendering: {
    label: "Rendering",
    icon: "loader",
    cls: "text-accent-2 bg-accent-soft border-accent/35",
  },
  done: { label: "Ready", icon: "check", cls: "text-good bg-good/12 border-good/30" },
  canceled: { label: "Canceled", icon: "close", cls: "text-ink-3 bg-bg-2 border-line" },
  error: { label: "Failed", icon: "close", cls: "text-danger bg-danger/12 border-danger/30" },
};

/** Render queue view: job list with live progress + download/cancel/remove. */
export function RenderQueue({ className }: { className?: string }) {
  const store = useStudio();
  const jobs = useSignalValue(store.jobs);
  const active = jobs.filter((j) => j.status === "queued" || j.status === "rendering").length;
  const done = jobs.filter((j) => j.status === "done").length;

  return (
    <div
      className={cn("flex-1 min-h-0 flex flex-col", className)}
      style={{
        background: "radial-gradient(120% 90% at 50% 0%, #16151c 0%, var(--color-bg-0) 70%)",
      }}
    >
      <div className="flex items-center gap-4 px-5.5 py-3.5 border-b border-line">
        <div className="flex items-center gap-4.5 text-[12px] text-ink-3">
          <span>
            <b className="font-mono text-[14px] text-ink-1 mr-1">{active}</b>active
          </span>
          <span>
            <b className="font-mono text-[14px] text-ink-1 mr-1">{done}</b>ready
          </span>
          <span>
            <b className="font-mono text-[14px] text-ink-1 mr-1">{jobs.length}</b>total
          </span>
        </div>
        <div className="flex-1" />
        {done > 0 && (
          <Button size="sm" tone="ghost" icon="trash" onClick={store.clearDone}>
            Clear ready
          </Button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scroll px-5.5 py-4 flex flex-col gap-2.5">
        {jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center h-full text-ink-3 gap-3">
            <div className="size-[52px] rounded-2xl bg-bg-2 grid place-items-center border border-line text-ink-3">
              <Icon name="server" size={22} />
            </div>
            <h4 className="m-0 mt-1 text-[15px] font-bold text-ink-1">No render jobs yet</h4>
            <p className="m-0 text-[13px] leading-relaxed max-w-[260px]">
              Renders and frame exports you queue will appear here with live progress.
            </p>
          </div>
        ) : (
          jobs.map((j) => {
            const sm = STATUS[j.status];
            const isStill = j.kind === "still";
            return (
              <div
                key={j.jobId}
                className={cn(
                  "flex items-center gap-3.5 bg-bg-1 border rounded-ui p-3.5",
                  j.status === "done" ? "border-good/20" : "border-line",
                )}
              >
                <div
                  className="size-[46px] flex-none rounded-[9px] grid place-items-center border border-line-2"
                  style={{
                    background: isStill
                      ? "linear-gradient(140deg,#4d2f1a,#16161b)"
                      : "linear-gradient(140deg,#2a2550,#16161b)",
                    color: "var(--color-accent-2)",
                  }}
                >
                  <Icon name={isStill ? "camera" : "film"} size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[13.5px] font-bold text-ink-1 truncate">{j.comp}</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full border",
                        sm.cls,
                      )}
                    >
                      <Icon
                        name={sm.icon}
                        size={11}
                        className={j.status === "rendering" ? "spin" : ""}
                      />
                      {sm.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-ink-3 mt-1.5 flex-wrap">
                    <span>{j.format.toUpperCase()}</span>
                    <span className="text-line-2">·</span>
                    <span>
                      {j.w}×{j.h}
                    </span>
                    <span className="text-line-2">·</span>
                    <span>{j.fps}fps</span>
                    <span className="text-line-2">·</span>
                    <span>{j.frames.toLocaleString()}f</span>
                    <span className="text-line-2">·</span>
                    <span>{j.rangeLabel}</span>
                    <span className="text-line-2">·</span>
                    <span>~{prettyMB(j.sizeEst)}</span>
                  </div>
                  {!isStill && (j.status === "queued" || j.status === "rendering") && (
                    <div className="flex items-center gap-2.5 mt-2">
                      <div className="flex-1 h-1 rounded-full bg-bg-3 overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full transition-[width]"
                          style={{ width: `${Math.round(j.progress * 100)}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10.5px] text-ink-2 w-9 text-right">
                        {Math.round(j.progress * 100)}%
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-0.5">
                  {j.status === "done" && (
                    <StTooltip content="Download">
                      <IconButton size="sm" icon="download" onClick={() => store.downloadJob(j)} />
                    </StTooltip>
                  )}
                  {(j.status === "queued" || j.status === "rendering") && (
                    <StTooltip content="Cancel">
                      <IconButton size="sm" icon="close" onClick={() => store.cancelJob(j.jobId)} />
                    </StTooltip>
                  )}
                  <StTooltip content="Remove">
                    <IconButton
                      size="sm"
                      tone="danger"
                      icon="trash"
                      iconSize={15}
                      onClick={() => store.removeJob(j.jobId)}
                    />
                  </StTooltip>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

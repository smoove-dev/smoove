import { useStudio } from "../../hooks/use-studio.js";
import { cn } from "../../lib/cn.js";
import { useSignalValue } from "../../signals/signal-bridge.js";
import { LayeredBody } from "./layered-body.js";
import { Scrubber } from "./scrubber.js";
import { TimelineHeader } from "./timeline-header.js";
import { Transport } from "./transport.js";

/** The full timeline dock: header (mode + readout), body (progress|layered), transport. */
export function Timeline({ className }: { className?: string }) {
  const store = useStudio();
  const tlMode = useSignalValue(store.tlMode);
  const layered = tlMode === "layered";
  return (
    <div className={cn("flex flex-col flex-none bg-bg-1 border-t border-line", className)}>
      <TimelineHeader />
      {layered ? (
        <LayeredBody />
      ) : (
        <div className="px-3 pt-1 pb-2">
          <Scrubber />
        </div>
      )}
      <Transport />
    </div>
  );
}

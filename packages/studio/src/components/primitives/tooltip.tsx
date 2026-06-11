import { Tooltip } from "@base-ui/react/tooltip";
import type { ReactElement, ReactNode } from "react";
import { usePortalContainer } from "./portal-context.js";

export type TooltipProps = {
  content?: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  children: ReactElement;
};

/** Thin Base UI Tooltip wrapper. Renders the child as-is when no content. */
export function StTooltip({ content, side = "top", children }: TooltipProps) {
  const container = usePortalContainer();
  if (!content) return children;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal container={container}>
        <Tooltip.Positioner side={side} sideOffset={7}>
          <Tooltip.Popup className="bg-black/92 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1.5 rounded-control border border-line-2 shadow-xl data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity">
            {content}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

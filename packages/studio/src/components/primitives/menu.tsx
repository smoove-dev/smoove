import { Menu } from "@base-ui/react/menu";
import type { ReactElement, ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { buttonCls } from "../button/button.js";
import { iconBtnCls } from "../button/icon-button.js";
import { Icon } from "../icon/icon.js";
import type { IconName } from "../icon/paths.js";
import { usePortalContainer } from "./portal-context.js";
import { StTooltip } from "./tooltip.js";

const popupCls = cn(
  "min-w-52 bg-bg-1/97 backdrop-blur-xl border border-line-2 rounded-ui p-1.5 shadow-[0_18px_44px_-12px_rgba(0,0,0,.7)] outline-none",
  "origin-[var(--transform-origin)] transition-[transform,opacity] data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0",
);

export type StMenuProps = {
  icon?: IconName;
  label?: string;
  tooltip?: ReactNode;
  /** Provide your own trigger element (rendered via Base UI `render`). */
  trigger?: ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  children: ReactNode;
};

export function StMenu({
  icon,
  label,
  tooltip,
  trigger,
  side = "bottom",
  align = "start",
  sideOffset = 6,
  children,
}: StMenuProps) {
  const container = usePortalContainer();
  let triggerEl: ReactElement;
  if (trigger) {
    triggerEl = <Menu.Trigger render={trigger} />;
  } else if (label) {
    triggerEl = (
      <Menu.Trigger
        className={buttonCls({ tone: "default", className: "data-[popup-open]:bg-bg-3" })}
      >
        {icon && <Icon name={icon} size={15} />} {label}{" "}
        <Icon name="chevron" size={13} className="text-ink-3" />
      </Menu.Trigger>
    );
  } else {
    triggerEl = (
      <Menu.Trigger
        className={iconBtnCls({
          tone: "bordered",
          className: "data-[popup-open]:bg-bg-3 data-[popup-open]:text-ink-1",
        })}
      >
        <Icon name={icon ?? "dots"} size={18} />
      </Menu.Trigger>
    );
  }

  return (
    <Menu.Root>
      {tooltip ? <StTooltip content={tooltip}>{triggerEl}</StTooltip> : triggerEl}
      <Menu.Portal container={container}>
        <Menu.Positioner side={side} align={align} sideOffset={sideOffset}>
          <Menu.Popup className={popupCls}>{children}</Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export type MenuItemProps = {
  icon?: IconName;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  badge?: number;
};

export function MenuItem({ icon, children, onClick, disabled, selected, badge }: MenuItemProps) {
  return (
    <Menu.Item
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-2 rounded-control text-[13px] font-medium cursor-default outline-none select-none",
        "text-ink-2 data-[highlighted]:bg-bg-3 data-[highlighted]:text-ink-1 data-[disabled]:opacity-40 data-[disabled]:pointer-events-none",
        selected && "text-ink-1",
      )}
    >
      {icon && <Icon name={icon} size={15} className="text-ink-3" />}
      <span className="flex-1">{children}</span>
      {badge != null && badge > 0 && (
        <span className="font-mono text-[10.5px] font-bold text-white bg-accent rounded-full min-w-[18px] h-[18px] px-1.5 grid place-items-center">
          {badge}
        </span>
      )}
      {selected && <Icon name="check" size={14} className="text-accent-2" />}
    </Menu.Item>
  );
}

export const MenuSeparator = () => <Menu.Separator className="h-px bg-line my-1 -mx-0.5" />;

import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";
import { cva } from "../../lib/cva.js";
import { Icon } from "../icon/icon.js";
import type { IconName } from "../icon/paths.js";

export type IconButtonTone = "default" | "bordered" | "danger";
export type IconButtonSize = "sm" | "md";

export const iconBtnCls = cva(
  "grid place-items-center rounded-ui text-ink-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40 disabled:cursor-not-allowed",
  {
    variants: {
      size: { sm: "size-[34px]", md: "size-[38px]" },
      tone: {
        default: "hover:bg-bg-3 hover:text-ink-1 data-[active]:text-accent-2",
        bordered: "bg-bg-2 border border-line hover:bg-bg-3 hover:text-ink-1 hover:border-line-2",
        danger: "hover:bg-danger/14 hover:text-danger",
      },
    },
    defaultVariants: { size: "md", tone: "default" },
  },
);

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon?: IconName;
  size?: IconButtonSize;
  tone?: IconButtonTone;
  active?: boolean;
  iconSize?: number;
  children?: ReactNode;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, size, tone, active, iconSize, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      data-active={active ? "" : undefined}
      className={iconBtnCls({ size, tone, className })}
      {...rest}
    >
      {icon && <Icon name={icon} size={iconSize ?? (size === "sm" ? 16 : 18)} />}
      {children}
    </button>
  );
});

import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cva } from "../../lib/cva.js";
import { Icon } from "../icon/icon.js";
import type { IconName } from "../icon/paths.js";

export type ButtonTone = "primary" | "default" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export const buttonCls = cva(
  "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap rounded-ui transition-colors disabled:opacity-45 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
  {
    variants: {
      tone: {
        primary:
          "text-white border border-transparent bg-gradient-to-b from-accent-2 to-accent shadow-[0_2px_14px_-3px_var(--color-accent-soft)] hover:brightness-110",
        default: "text-ink-1 bg-bg-2 border border-line-2 hover:bg-bg-3",
        ghost: "text-ink-2 bg-transparent border border-transparent hover:bg-bg-2 hover:text-ink-1",
        danger: "text-danger bg-transparent border border-transparent hover:bg-danger/12",
      },
      size: { sm: "text-xs px-2.5 py-1.5", md: "text-[13px] px-3.5 py-2" },
    },
    defaultVariants: { tone: "default", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone;
  size?: ButtonSize;
  icon?: IconName;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { tone, size, className, icon, children, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonCls({ tone, size, className })} {...rest}>
      {icon && <Icon name={icon} size={15} />}
      {children}
    </button>
  );
});

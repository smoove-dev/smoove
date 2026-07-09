import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

/**
 * A labeled dialog field. Mirrors the props inspector's field styling
 * (`schema-form/field.tsx`) so dialog forms read as the same surface: a
 * 12.5px medium ink-2 label above the control, with matching spacing.
 */
export function DialogField({
  label,
  description,
  children,
  className,
}: {
  label?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4", className)}>
      {label && <div className="text-[12.5px] text-ink-2 font-medium mb-2">{label}</div>}
      {children}
      {description && (
        <div className="text-[11px] text-ink-3 mt-1.5 leading-relaxed">{description}</div>
      )}
    </div>
  );
}

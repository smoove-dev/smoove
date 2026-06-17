import type { ReactNode } from "react";

type Variant = "accent" | "good" | "warn" | "neutral";

// Inline status badge — the MDX replacement for the old `{{accent:text}}` syntax.
const VARIANTS: Record<Variant, string> = {
  accent: "bg-fd-primary/10 text-fd-primary",
  good: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  neutral: "bg-fd-muted text-fd-muted-foreground",
};

export function Badge({
  variant = "neutral",
  children,
}: {
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 align-middle font-medium text-xs ${VARIANTS[variant]}`}
    >
      {children}
    </span>
  );
}

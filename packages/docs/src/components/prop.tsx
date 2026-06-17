import type { ReactNode } from "react";
import { Badge } from "./badge";

// Property entry — the MDX replacement for the old `:::prop name | sig | badge`
// container. Reads better than a table for signature-style API reference.
export function Prop({
  name,
  sig,
  badge,
  children,
}: {
  name: string;
  sig?: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <div className="my-4 rounded-lg border border-fd-border bg-fd-card p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <code className="font-semibold text-fd-foreground">{name}</code>
        {sig ? <code className="text-fd-muted-foreground text-sm">{sig}</code> : null}
        {badge ? <Badge variant="accent">{badge}</Badge> : null}
      </div>
      <div className="mt-2 text-fd-muted-foreground text-sm [&_p]:my-0">{children}</div>
    </div>
  );
}

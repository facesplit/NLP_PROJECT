import type { ReactNode } from "react";
import { Sprig } from "./Sprig";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-rose/30 bg-card/50 px-8 py-16 text-center">
      <Sprig className="h-10 w-10 text-rose/60" />
      <h3 className="display-italic text-2xl text-rose-deep">{title}</h3>
      {description && (
        <p className="max-w-md text-sm text-muted-foreground text-balance">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

import { Fragment } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepperStep {
  key: string;
  label: string;
}

interface StepperProps {
  steps: StepperStep[];
  current: number; // zero-indexed
  onJump?: (index: number) => void;
  /** Highest index the user is allowed to click. Defaults to `current` (no forward jumps). */
  furthest?: number;
}

export function Stepper({ steps, current, onJump, furthest }: StepperProps) {
  const limit = furthest ?? current;
  return (
    <ol className="flex w-full items-start">
      {steps.map((s, i) => {
        const isDone = i < current;
        const isCurrent = i === current;
        const canJump = !!onJump && i <= limit;
        const isLast = i === steps.length - 1;
        return (
          <Fragment key={s.key}>
            <li className="flex min-w-0 flex-col items-center gap-1.5">
              <button
                type="button"
                disabled={!canJump}
                onClick={() => canJump && onJump?.(i)}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-full text-xs font-medium transition-all",
                  isCurrent &&
                    "bg-rose-deep text-primary-foreground ring-4 ring-rose-soft",
                  isDone &&
                    "bg-sage text-white hover:bg-sage/90",
                  !isCurrent && !isDone && canJump &&
                    "border border-rose/40 bg-card text-rose-deep hover:bg-rose-soft",
                  !isCurrent && !isDone && !canJump &&
                    "border border-border bg-card/60 text-muted-foreground/60 cursor-not-allowed",
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </button>
              <span
                className={cn(
                  "text-center text-[10px] uppercase tracking-[0.12em] leading-tight max-w-[5.5rem] truncate",
                  isCurrent && "text-rose-deep font-medium",
                  isDone && "text-foreground/70",
                  !isCurrent && !isDone && "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </li>
            {!isLast && (
              <div
                className={cn(
                  "mt-4 h-px flex-1 transition-colors",
                  isDone ? "bg-sage/60" : "bg-border",
                )}
                aria-hidden
              />
            )}
          </Fragment>
        );
      })}
    </ol>
  );
}

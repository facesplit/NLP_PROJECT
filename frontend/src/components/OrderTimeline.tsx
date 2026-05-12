import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Order } from "@/api/types";
import { formatDateTime } from "@/lib/utils";

interface Step {
  key: string;
  label: string;
  ts?: string | null;
  state: "done" | "current" | "future" | "cancelled";
}

export function OrderTimeline({ order }: { order: Order }) {
  const { t } = useTranslation();
  const isFinal = ["completed", "declined", "cancelled", "cancelled_by_florist", "rejected_by_client"].includes(order.status);

  const steps: Step[] = [
    {
      key: "created",
      label: t("order_timeline.created"),
      ts: order.created_at,
      state: "done",
    },
  ];

  if (order.status === "declined") {
    steps.push({ key: "declined", label: t("order_timeline.declined"), ts: null, state: "cancelled" });
  } else if (order.status === "cancelled") {
    steps.push({ key: "cancelled", label: t("order_timeline.cancelled_by_client"), ts: null, state: "cancelled" });
  } else {
    steps.push({
      key: "accepted",
      label: t("order_timeline.accepted"),
      ts: order.accepted_at,
      state: order.accepted_at ? "done" : order.status === "pending" ? "current" : "future",
    });
    if (order.status !== "cancelled_by_florist" || order.in_progress_at) {
      steps.push({
        key: "in_progress",
        label: t("order_timeline.in_progress"),
        ts: order.in_progress_at,
        state: order.in_progress_at
          ? "done"
          : order.status === "accepted"
          ? "current"
          : "future",
      });
    }
    if (order.status === "cancelled_by_florist") {
      steps.push({ key: "cancelled_florist", label: t("order_timeline.cancelled_by_florist"), ts: null, state: "cancelled" });
    } else {
      steps.push({
        key: "ready",
        label: t("order_timeline.ready"),
        ts: order.ready_at,
        state: order.ready_at ? "done" : order.status === "in_progress" ? "current" : "future",
      });
      if (order.status === "rejected_by_client") {
        steps.push({ key: "rejected", label: t("order_timeline.rejected_by_client"), ts: null, state: "cancelled" });
      } else {
        steps.push({
          key: "completed",
          label: t("order_timeline.completed"),
          ts: order.completed_at,
          state: order.completed_at
            ? "done"
            : order.status === "ready_for_pickup"
            ? "current"
            : "future",
        });
      }
    }
  }

  return (
    <ol className="relative space-y-4">
      {steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        return (
          <li key={s.key} className="relative flex gap-3 pb-1">
            {!isLast && (
              <span className="absolute left-[11px] top-6 h-[calc(100%-12px)] w-px bg-border" />
            )}
            <span
              className={`relative z-10 mt-0.5 grid h-6 w-6 place-items-center rounded-full ${
                s.state === "done"
                  ? "bg-sage text-paper"
                  : s.state === "cancelled"
                  ? "bg-destructive/15 text-destructive"
                  : s.state === "current"
                  ? "bg-rose-deep text-paper animate-pulse"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s.state === "done" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : s.state === "cancelled" ? (
                <XCircle className="h-4 w-4" />
              ) : (
                <Clock className="h-3.5 w-3.5" />
              )}
            </span>
            <div className="flex-1">
              <div className={`text-sm font-medium ${s.state === "future" ? "text-muted-foreground" : "text-foreground"}`}>
                {s.label}
              </div>
              {s.ts && (
                <div className="text-xs text-muted-foreground">{formatDateTime(s.ts)}</div>
              )}
            </div>
          </li>
        );
      })}
      {isFinal && order.decline_reason && (
        <li className="ml-9 rounded-md bg-destructive/5 p-3 text-sm">
          <div className="text-xs uppercase tracking-wider text-destructive">{t("order_timeline.decline_reason")}</div>
          <div>{order.decline_reason}</div>
        </li>
      )}
      {isFinal && order.cancel_reason && (
        <li className="ml-9 rounded-md bg-destructive/5 p-3 text-sm">
          <div className="text-xs uppercase tracking-wider text-destructive">{t("order_timeline.cancel_reason")}</div>
          <div>{order.cancel_reason}</div>
        </li>
      )}
      {isFinal && order.rejection_reason && (
        <li className="ml-9 rounded-md bg-destructive/5 p-3 text-sm">
          <div className="text-xs uppercase tracking-wider text-destructive">{t("order_timeline.rejection_reason")}</div>
          <div>{order.rejection_reason}</div>
        </li>
      )}
    </ol>
  );
}

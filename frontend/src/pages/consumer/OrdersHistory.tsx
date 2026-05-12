import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/api";
import type { OrderStatus } from "@/api/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Sparkles, Inbox } from "lucide-react";
import { formatDateTime, formatPrice } from "@/lib/utils";

export function OrdersHistory() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<OrderStatus | "all">("all");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", "consumer", status],
    queryFn: () => api.orders.listMine({ status }),
  });

  const { data: points = [] } = useQuery({
    queryKey: ["points"],
    queryFn: () => api.points.listPublic(),
  });
  const pointName = (id: string) => points.find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">{t("consumer.orders_history.kicker")}</p>
          <h1 className="font-display text-4xl">{t("consumer.orders_history.title")}</h1>
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus | "all")}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("consumer.orders_history.status_filter.all")}</SelectItem>
            <SelectItem value="pending">{t("consumer.orders_history.status_filter.pending")}</SelectItem>
            <SelectItem value="accepted">{t("consumer.orders_history.status_filter.accepted")}</SelectItem>
            <SelectItem value="in_progress">{t("consumer.orders_history.status_filter.in_progress")}</SelectItem>
            <SelectItem value="ready_for_pickup">{t("consumer.orders_history.status_filter.ready_for_pickup")}</SelectItem>
            <SelectItem value="completed">{t("consumer.orders_history.status_filter.completed")}</SelectItem>
            <SelectItem value="declined">{t("consumer.orders_history.status_filter.declined")}</SelectItem>
            <SelectItem value="cancelled">{t("consumer.orders_history.status_filter.cancelled")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("consumer.orders_history.loading")}</p>
      ) : orders.length === 0 ? (
        <EmptyState
          title={t("consumer.orders_history.empty_title")}
          description={t("consumer.orders_history.empty_text")}
          action={
            <Button asChild>
              <Link to="/search">{t("consumer.orders_history.empty_cta")}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {orders.map((o) => (
            <Link
              key={o.id}
              to={`/orders/${o.id}`}
              className="paper-card rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-md grid gap-4 sm:grid-cols-[100px_1fr_auto] items-center"
            >
              <div className="aspect-square overflow-hidden rounded-lg bg-cream">
                {o.result_image ? (
                  <img src={o.result_image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    {o.source === "ai_generated" ? (
                      <Sparkles className="h-8 w-8 text-rose/60" />
                    ) : (
                      <Inbox className="h-8 w-8 text-sage/60" />
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-xl">
                    {o.source === "ai_generated" ? t("consumer.orders_history.source_ai") : t("consumer.orders_history.source_portfolio")}
                  </h3>
                  <OrderStatusBadge status={o.status} />
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("consumer.orders_history.workshop_label", { name: pointName(o.point_id) })}
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {o.id.slice(-8)} · {formatDateTime(o.created_at)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("consumer.orders_history.total")}</div>
                <div className="font-display text-2xl text-rose-deep">{formatPrice(o.total_price)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

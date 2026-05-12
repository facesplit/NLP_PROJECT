import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Inbox } from "lucide-react";
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
import { formatDateTime, formatPrice } from "@/lib/utils";

export function OrdersListFlorist() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<OrderStatus | "all">("all");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", "florist", status],
    queryFn: () => api.orders.listMine({ status }),
  });

  const { data: points = [] } = useQuery({
    queryKey: ["florist", "points"],
    queryFn: () => api.points.listMine(),
  });

  const pointName = (id: string) => points.find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">{t("florist.orders_list.kicker")}</p>
          <h1 className="font-display text-4xl">{t("florist.orders_list.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("florist.orders_list.subtitle")}
          </p>
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus | "all")}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("florist.orders_list.status_filter.all")}</SelectItem>
            <SelectItem value="pending">{t("florist.orders_list.status_filter.pending")}</SelectItem>
            <SelectItem value="accepted">{t("florist.orders_list.status_filter.accepted")}</SelectItem>
            <SelectItem value="in_progress">{t("florist.orders_list.status_filter.in_progress")}</SelectItem>
            <SelectItem value="ready_for_pickup">{t("florist.orders_list.status_filter.ready_for_pickup")}</SelectItem>
            <SelectItem value="completed">{t("florist.orders_list.status_filter.completed")}</SelectItem>
            <SelectItem value="declined">{t("florist.orders_list.status_filter.declined")}</SelectItem>
            <SelectItem value="cancelled">{t("florist.orders_list.status_filter.cancelled")}</SelectItem>
            <SelectItem value="cancelled_by_florist">{t("florist.orders_list.status_filter.cancelled_by_florist")}</SelectItem>
            <SelectItem value="rejected_by_client">{t("florist.orders_list.status_filter.rejected_by_client")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("florist.orders_list.loading")}</p>
      ) : orders.length === 0 ? (
        <EmptyState
          title={t("florist.orders_list.empty_title")}
          description={t("florist.orders_list.empty_text")}
        />
      ) : (
        <div className="paper-card overflow-hidden rounded-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-cream/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t("florist.orders_list.table.order")}</th>
                <th className="px-4 py-3 font-medium">{t("florist.orders_list.table.point")}</th>
                <th className="px-4 py-3 font-medium">{t("florist.orders_list.table.source")}</th>
                <th className="px-4 py-3 font-medium">{t("florist.orders_list.table.total")}</th>
                <th className="px-4 py-3 font-medium">{t("florist.orders_list.table.status")}</th>
                <th className="px-4 py-3 font-medium">{t("florist.orders_list.table.created")}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  className="border-t border-border/60 transition-colors hover:bg-cream/40"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/florist/orders/${o.id}`}
                      className="font-mono text-xs text-rose-deep hover:underline"
                    >
                      {o.id.slice(-8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium">{pointName(o.point_id)}</td>
                  <td className="px-4 py-3">
                    {o.source === "ai_generated" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-rose-deep">
                        <Sparkles className="h-3 w-3" /> {t("florist.orders_list.source_ai")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-sage">
                        <Inbox className="h-3 w-3" /> {t("florist.orders_list.source_portfolio")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">{formatPrice(o.total_price)}</td>
                  <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {formatDateTime(o.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

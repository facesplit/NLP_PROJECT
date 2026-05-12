import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, Sparkles, Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";

import { api, ApiError } from "@/api";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { OrderTimeline } from "@/components/OrderTimeline";
import { formatDateTime, formatPrice } from "@/lib/utils";

export function OrderDetailConsumer() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  // Florists end up here too via /orders/:id; redirect them to florist detail.
  useEffect(() => {
    if (user?.role === "floristadmin" && id) {
      navigate(`/florist/orders/${id}`, { replace: true });
    }
  }, [user, id, navigate]);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => api.orders.get(id!),
    enabled: !!id && user?.role === "consumer",
  });

  const { data: point } = useQuery({
    queryKey: ["point", order?.point_id],
    queryFn: () => api.points.get(order!.point_id),
    enabled: !!order,
  });

  const cancel = useMutation({
    mutationFn: () => api.orders.cancelByConsumer(id!),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success(t("consumer.order_detail.cancel_toast"));
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t("consumer.order_detail.error_default")),
  });

  const accept = useMutation({
    mutationFn: () => api.orders.complete(id!),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success(t("consumer.order_detail.complete_toast"));
    },
  });

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const reject = useMutation({
    mutationFn: () => api.orders.rejectResult(id!, reason),
    onSuccess: () => {
      qc.invalidateQueries();
      setRejectOpen(false);
      setReason("");
      toast.success(t("consumer.order_detail.reject_toast"));
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t("consumer.order_detail.error_default")),
  });

  if (isLoading || !order) return <p className="text-muted-foreground">{t("consumer.order_detail.loading")}</p>;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/profile/orders")}>
        <ChevronLeft className="h-4 w-4" /> {t("consumer.order_detail.back")}
      </Button>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="paper-card rounded-2xl p-7 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{order.id.slice(-8)}</span>
                  <span>·</span>
                  <span>{formatDateTime(order.created_at)}</span>
                </div>
                <h1 className="font-display text-4xl mt-1">
                  {order.source === "ai_generated" ? t("consumer.order_detail.source_ai") : t("consumer.order_detail.source_portfolio")}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t("consumer.order_detail.workshop_label", { name: point?.name ?? "" })}
                </p>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {order.source === "ai_generated" ? (
                <>
                  <Sparkles className="h-4 w-4 text-rose-deep" />
                  <span>
                    {order.budget
                      ? t("consumer.order_detail.ai_meta_with_budget", { budget: formatPrice(order.budget) })
                      : t("consumer.order_detail.ai_meta")}
                  </span>
                </>
              ) : (
                <>
                  <Inbox className="h-4 w-4 text-sage" />
                  <span>{t("consumer.order_detail.portfolio_meta")}</span>
                </>
              )}
            </div>
          </div>

          {order.result_image && (
            <div className="paper-card overflow-hidden rounded-2xl">
              <div className="p-7 pb-3">
                <h2 className="font-display text-2xl">{t("consumer.order_detail.result_title")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("consumer.order_detail.result_subtitle")}
                </p>
              </div>
              <img src={order.result_image} alt={t("consumer.order_detail.result_alt")} className="w-full" />
            </div>
          )}

          <div className="paper-card rounded-2xl p-7 space-y-3">
            <h2 className="font-display text-2xl">{t("consumer.order_detail.composition_title")}</h2>
            <ul className="divide-y divide-border/70">
              {order.composition_snapshot.map((c) => (
                <li key={c.flower_id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.quantity} × {formatPrice(c.price_per_stem)}
                    </div>
                  </div>
                  <div className="font-medium">
                    {formatPrice(c.quantity * c.price_per_stem)}
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm uppercase tracking-wider text-muted-foreground">{t("consumer.order_detail.total")}</span>
              <span className="font-display text-2xl text-rose-deep">{formatPrice(order.total_price)}</span>
            </div>
          </div>

          {order.client_message && (
            <div className="paper-card rounded-2xl p-7">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                {t("consumer.order_detail.client_message_label")}
              </div>
              <p className="display-italic text-lg">«{order.client_message}»</p>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="paper-card rounded-2xl p-6 space-y-3">
            <h3 className="font-display text-xl">{t("consumer.order_detail.next_title")}</h3>
            {order.status === "pending" && (
              <>
                <p className="text-sm text-muted-foreground">
                  {t("consumer.order_detail.pending_text")}
                </p>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    if (confirm(t("consumer.order_detail.confirm_cancel"))) cancel.mutate();
                  }}
                >
                  {t("consumer.order_detail.pending_cancel")}
                </Button>
              </>
            )}
            {order.status === "accepted" && (
              <p className="text-sm text-muted-foreground">
                {t("consumer.order_detail.accepted_text")}
              </p>
            )}
            {order.status === "in_progress" && (
              <p className="text-sm text-muted-foreground">
                {t("consumer.order_detail.in_progress_text")}
              </p>
            )}
            {order.status === "ready_for_pickup" && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t("consumer.order_detail.ready_text")}
                </p>
                <Button className="w-full" onClick={() => accept.mutate()} disabled={accept.isPending}>
                  {t("consumer.order_detail.ready_accept")}
                </Button>
                <Button className="w-full" variant="outline" onClick={() => setRejectOpen(true)}>
                  {t("consumer.order_detail.ready_reject")}
                </Button>
              </div>
            )}
            {(order.status === "completed" ||
              order.status === "declined" ||
              order.status === "cancelled" ||
              order.status === "cancelled_by_florist" ||
              order.status === "rejected_by_client") && (
              <p className="text-sm text-muted-foreground">{t("consumer.order_detail.final_text")}</p>
            )}
          </div>

          <div className="paper-card rounded-2xl p-6 space-y-3">
            <h3 className="font-display text-xl">{t("consumer.order_detail.timeline_title")}</h3>
            <OrderTimeline order={order} />
          </div>
        </aside>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("consumer.order_detail.reject_dialog.title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("consumer.order_detail.reject_dialog.subtitle")}
          </p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("consumer.order_detail.reject_dialog.placeholder")}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>{t("consumer.order_detail.reject_dialog.cancel")}</Button>
            <Button
              variant="destructive"
              onClick={() => reject.mutate()}
              disabled={reject.isPending || !reason.trim()}
            >
              {t("consumer.order_detail.reject_dialog.send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

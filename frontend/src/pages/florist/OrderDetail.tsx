import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, Sparkles, Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";

import { api, ApiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageUpload } from "@/components/ImageUpload";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { OrderTimeline } from "@/components/OrderTimeline";
import { formatDateTime, formatPrice } from "@/lib/utils";

export function OrderDetailFlorist() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => api.orders.get(id!),
    enabled: !!id,
  });

  const { data: point } = useQuery({
    queryKey: ["point", order?.point_id],
    queryFn: () => api.points.get(order!.point_id),
    enabled: !!order,
  });

  const consumer = order && order.consumer_id;

  const accept = useMutation({
    mutationFn: () => api.orders.accept(id!),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success(t("florist.order_detail.accept_toast"));
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        if (e.details?.subcode === "OUT_OF_STOCK") {
          const list = (e.details.shortages as { name: string; needed: number; have: number }[]).map(
            (s) => t("florist.order_detail.shortage_line", { name: s.name, needed: s.needed, have: s.have }),
          );
          toast.error(t("florist.order_detail.out_of_stock_title"), { description: list.join("\n") });
          return;
        }
        toast.error(e.message);
      } else toast.error(t("florist.order_detail.accept_failed"));
    },
  });
  const start = useMutation({
    mutationFn: () => api.orders.start(id!),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success(t("florist.order_detail.start_toast"));
    },
  });

  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const decline = useMutation({
    mutationFn: () => api.orders.decline(id!, declineReason),
    onSuccess: () => {
      qc.invalidateQueries();
      setDeclineOpen(false);
      setDeclineReason("");
      toast.success(t("florist.order_detail.decline_toast"));
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t("florist.order_detail.error_default")),
  });

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const cancelByFlorist = useMutation({
    mutationFn: () => api.orders.cancelByFlorist(id!, cancelReason),
    onSuccess: () => {
      qc.invalidateQueries();
      setCancelOpen(false);
      setCancelReason("");
      toast.success(t("florist.order_detail.cancel_toast"));
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t("florist.order_detail.error_default")),
  });

  const [readyOpen, setReadyOpen] = useState(false);
  const [readyPhoto, setReadyPhoto] = useState<string | null>(null);
  const ready = useMutation({
    mutationFn: () => api.orders.ready(id!, readyPhoto!),
    onSuccess: () => {
      qc.invalidateQueries();
      setReadyOpen(false);
      setReadyPhoto(null);
      toast.success(t("florist.order_detail.ready_toast"));
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t("florist.order_detail.error_default")),
  });

  if (isLoading || !order) return <p className="text-muted-foreground">{t("florist.order_detail.loading")}</p>;

  const stockOrigin = order.composition_snapshot;
  const status = order.status;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/florist/orders")}>
        <ChevronLeft className="h-4 w-4" /> {t("florist.order_detail.back")}
      </Button>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="paper-card rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{order.id.slice(-8)}</span>
                  <span>·</span>
                  <span>{formatDateTime(order.created_at)}</span>
                </div>
                <h1 className="font-display text-4xl mt-1">
                  {order.source === "ai_generated" ? t("florist.order_detail.source_ai") : t("florist.order_detail.source_portfolio")}
                </h1>
                <p className="text-sm text-muted-foreground">{point?.name}</p>
              </div>
              <OrderStatusBadge status={status} />
            </div>

            {order.source === "ai_generated" && (
              <div className="rounded-md bg-rose-soft/40 p-3 text-sm">
                <div className="flex items-center gap-1 text-xs uppercase tracking-wider text-rose-deep">
                  <Sparkles className="h-3 w-3" /> {t("florist.order_detail.ai_variant", { n: (order.ai_variant_index ?? 0) + 1 })}
                </div>
                {order.budget && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t("florist.order_detail.ai_budget", { budget: formatPrice(order.budget) })}
                  </div>
                )}
              </div>
            )}

            {order.source === "portfolio" && (
              <div className="rounded-md bg-sage/10 p-3 text-sm">
                <div className="flex items-center gap-1 text-xs uppercase tracking-wider text-sage">
                  <Inbox className="h-3 w-3" /> {t("florist.order_detail.from_portfolio")}
                </div>
              </div>
            )}

            {order.client_message && (
              <div className="rounded-md bg-cream/60 p-3 text-sm">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {t("florist.order_detail.client_message_label")}
                </div>
                <p className="display-italic text-base">«{order.client_message}»</p>
              </div>
            )}
          </div>

          <div className="paper-card rounded-xl p-6 space-y-3">
            <h2 className="font-display text-2xl">{t("florist.order_detail.composition_title")}</h2>
            <ul className="divide-y divide-border/70">
              {stockOrigin.map((c) => (
                <li key={c.flower_id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.quantity} × {formatPrice(c.price_per_stem)}
                    </div>
                  </div>
                  <div className="font-medium">{formatPrice(c.quantity * c.price_per_stem)}</div>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm uppercase tracking-wider text-muted-foreground">{t("florist.order_detail.total")}</span>
              <span className="font-display text-2xl text-rose-deep">{formatPrice(order.total_price)}</span>
            </div>
          </div>

          {order.result_image && (
            <div className="paper-card rounded-xl overflow-hidden">
              <div className="p-6 pb-3">
                <h2 className="font-display text-2xl">{t("florist.order_detail.result_title")}</h2>
                <p className="text-xs text-muted-foreground">{t("florist.order_detail.result_subtitle")}</p>
              </div>
              <img src={order.result_image} alt={t("florist.order_detail.result_alt")} className="w-full" />
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="paper-card rounded-xl p-6 space-y-3">
            <h3 className="font-display text-xl">{t("florist.order_detail.actions_title")}</h3>
            {status === "pending" && (
              <div className="space-y-2">
                <Button className="w-full" onClick={() => accept.mutate()} disabled={accept.isPending}>
                  {t("florist.order_detail.accept")}
                </Button>
                <Button className="w-full" variant="outline" onClick={() => setDeclineOpen(true)}>
                  {t("florist.order_detail.decline")}
                </Button>
              </div>
            )}
            {status === "accepted" && (
              <div className="space-y-2">
                <Button className="w-full" onClick={() => start.mutate()} disabled={start.isPending}>
                  {t("florist.order_detail.start")}
                </Button>
                <Button className="w-full" variant="outline" onClick={() => setCancelOpen(true)}>
                  {t("florist.order_detail.cancel")}
                </Button>
              </div>
            )}
            {status === "in_progress" && (
              <div className="space-y-2">
                <Button className="w-full" onClick={() => setReadyOpen(true)}>
                  {t("florist.order_detail.ready_cta")}
                </Button>
                <Button className="w-full" variant="outline" onClick={() => setCancelOpen(true)}>
                  {t("florist.order_detail.cancel")}
                </Button>
              </div>
            )}
            {status === "ready_for_pickup" && (
              <p className="rounded-md bg-cream p-3 text-sm text-muted-foreground">
                {t("florist.order_detail.waiting_pickup")}
              </p>
            )}
            {(status === "completed" || status === "declined" || status === "cancelled" || status === "cancelled_by_florist" || status === "rejected_by_client") && (
              <p className="rounded-md bg-cream p-3 text-sm text-muted-foreground">
                {t("florist.order_detail.closed")}
              </p>
            )}
          </div>

          <div className="paper-card rounded-xl p-6 space-y-3">
            <h3 className="font-display text-xl">{t("florist.order_detail.timeline_title")}</h3>
            <OrderTimeline order={order} />
          </div>

          <div className="paper-card rounded-xl p-6 space-y-2 text-sm">
            <h3 className="font-display text-xl">{t("florist.order_detail.client_title")}</h3>
            <div className="font-mono text-xs text-muted-foreground">{consumer?.slice(-8)}</div>
          </div>
        </aside>
      </div>

      {/* Decline dialog */}
      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("florist.order_detail.decline_dialog.title")}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder={t("florist.order_detail.decline_dialog.placeholder")}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeclineOpen(false)}>{t("florist.order_detail.decline_dialog.cancel")}</Button>
            <Button variant="destructive" onClick={() => decline.mutate()} disabled={decline.isPending || !declineReason.trim()}>
              {t("florist.order_detail.decline_dialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel by florist */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("florist.order_detail.cancel_dialog.title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("florist.order_detail.cancel_dialog.subtitle")}
          </p>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder={t("florist.order_detail.cancel_dialog.placeholder")}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>{t("florist.order_detail.cancel_dialog.keep")}</Button>
            <Button variant="destructive" onClick={() => cancelByFlorist.mutate()} disabled={cancelByFlorist.isPending || !cancelReason.trim()}>
              {t("florist.order_detail.cancel_dialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ready dialog */}
      <Dialog open={readyOpen} onOpenChange={setReadyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("florist.order_detail.ready_dialog.title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("florist.order_detail.ready_dialog.subtitle")}
          </p>
          <ImageUpload value={readyPhoto} onChange={setReadyPhoto} aspect="square" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReadyOpen(false)}>{t("florist.order_detail.ready_dialog.cancel")}</Button>
            <Button onClick={() => ready.mutate()} disabled={!readyPhoto || ready.isPending}>
              {t("florist.order_detail.ready_dialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

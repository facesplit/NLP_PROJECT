import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, MapPin, Star, Sparkles, Send } from "lucide-react";
import { toast } from "sonner";
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
import { ColorDots } from "@/components/ColorTagPicker";
import { EmptyState } from "@/components/EmptyState";
import { formatPrice } from "@/lib/utils";
import type { PortfolioBouquet } from "@/api/types";

export function PointDetailConsumer() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: point } = useQuery({
    queryKey: ["point", id],
    queryFn: () => api.points.get(id!),
    enabled: !!id,
  });

  const { data: portfolio = [], isLoading } = useQuery({
    queryKey: ["portfolio", id],
    queryFn: () => api.portfolio.list(id!),
    enabled: !!id,
  });

  const [selected, setSelected] = useState<PortfolioBouquet | null>(null);
  const [message, setMessage] = useState("");

  const order = useMutation({
    mutationFn: () =>
      api.orders.create({
        point_id: id!,
        source: "portfolio",
        portfolio_bouquet_id: selected!.id,
        client_message: message,
      }),
    onSuccess: (o) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      setSelected(null);
      setMessage("");
      toast.success(t("consumer.point_detail.submit_toast_title"), {
        description: t("consumer.point_detail.submit_toast_desc"),
      });
      navigate(`/orders/${o.id}`);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t("consumer.point_detail.error_default")),
  });

  if (!point) return <p className="text-muted-foreground">{t("consumer.point_detail.loading")}</p>;

  return (
    <div className="space-y-10">
      <Button variant="ghost" size="sm" onClick={() => navigate("/search")}>
        <ChevronLeft className="h-4 w-4" /> {t("consumer.point_detail.back")}
      </Button>

      {/* Hero */}
      <section className="paper-card relative overflow-hidden rounded-2xl">
        <div className="relative aspect-[21/9]">
          {point.cover_image && (
            <img src={point.cover_image} alt={point.name} className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/65 via-ink/20 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 lg:bottom-10 lg:left-12 text-cream space-y-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-card/95 px-2.5 py-1 text-xs font-medium text-foreground">
              <Star className="h-3 w-3 fill-rose-deep text-rose-deep" />
              {point.rating.toFixed(1)}
            </div>
            <h1 className="font-display text-5xl lg:text-6xl leading-[0.95]">{point.name}</h1>
            <div className="flex items-center gap-1.5 text-sm">
              <MapPin className="h-4 w-4" />
              {point.address}
            </div>
          </div>
        </div>
        <div className="grid gap-6 p-7 md:grid-cols-[1fr_auto] md:items-center">
          <p className="display-italic text-xl text-balance text-foreground/80 max-w-2xl">
            {point.description ?? t("consumer.point_detail.description_default")}
          </p>
          <Button size="lg" asChild>
            <Link to={`/points/${id}/generate`}>
              <Sparkles className="h-4 w-4" /> {t("consumer.point_detail.generate_cta")}
            </Link>
          </Button>
        </div>
      </section>

      <div className="space-y-6">
        <div className="ornament-divider">
          <span className="text-xs uppercase tracking-[0.32em]">{t("consumer.point_detail.portfolio_divider")}</span>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">{t("consumer.point_detail.loading")}</p>
        ) : portfolio.length === 0 ? (
          <EmptyState
            title={t("consumer.point_detail.empty_title")}
            description={t("consumer.point_detail.empty_text")}
            action={
              <Button asChild>
                <Link to={`/points/${id}/generate`}>
                  <Sparkles className="h-4 w-4" /> {t("consumer.point_detail.empty_cta")}
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {portfolio.map((b) => (
              <article
                key={b.id}
                className="group paper-card overflow-hidden rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="relative aspect-[4/5] overflow-hidden">
                  <img
                    src={b.image}
                    alt={b.name}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute left-3 top-3">
                    <ColorDots tags={b.color_tags} />
                  </div>
                </div>
                <div className="space-y-3 p-5">
                  <div>
                    <h3 className="font-display text-2xl leading-tight">{b.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{b.description}</p>
                  </div>
                  <div className="flex items-end justify-between pt-1">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("consumer.point_detail.price_label")}</div>
                      <div className="font-display text-2xl text-rose-deep">{formatPrice(b.price)}</div>
                    </div>
                    <Button size="sm" variant="soft" onClick={() => setSelected(b)}>
                      <Send className="h-3 w-3" /> {t("consumer.point_detail.card_cta")}
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("consumer.point_detail.dialog.title")}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex gap-3 rounded-lg bg-cream/60 p-3">
                <img src={selected.image} alt="" className="h-16 w-16 rounded-md object-cover" />
                <div className="flex-1">
                  <div className="font-display text-lg">{selected.name}</div>
                  <div className="text-sm text-muted-foreground">{formatPrice(selected.price)}</div>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t("consumer.point_detail.dialog.msg_label")}
                </div>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("consumer.point_detail.dialog.msg_placeholder")}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelected(null)}>{t("consumer.point_detail.dialog.cancel")}</Button>
            <Button onClick={() => order.mutate()} disabled={order.isPending}>
              {order.isPending ? t("consumer.point_detail.dialog.submitting") : t("consumer.point_detail.dialog.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

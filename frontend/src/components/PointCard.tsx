import { Star, MapPin, Flower2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { PointPublic } from "@/api";

export function PointCard({ point }: { point: PointPublic }) {
  const { t } = useTranslation();
  return (
    <Link
      to={`/points/${point.id}`}
      className="group paper-card block overflow-hidden rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        {point.cover_image ? (
          <img
            src={point.cover_image}
            alt={point.name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-rose-soft via-cream to-sage/30" />
        )}
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-card/95 px-2.5 py-1 text-xs font-medium shadow-sm">
          <Star className="h-3 w-3 fill-rose-deep text-rose-deep" />
          {point.rating.toFixed(1)}
        </div>
      </div>
      <div className="space-y-2 p-5">
        <h3 className="font-display text-2xl leading-tight">{point.name}</h3>
        <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose/70" />
          <span className="line-clamp-1">{point.address}</span>
        </div>
        <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Flower2 className="h-3.5 w-3.5 text-sage" />
            {t("point_card.bouquet_count", { count: point.portfolio_count })}
          </span>
          <span className="text-border">·</span>
          <span>{t("point_card.flower_kind_count", { count: point.flower_count })}</span>
        </div>
      </div>
    </Link>
  );
}

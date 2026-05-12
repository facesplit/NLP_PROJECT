import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PortfolioBouquet } from "@/api/types";
import { ColorDots } from "./ColorTagPicker";
import { Button } from "./ui/button";
import { formatPrice } from "@/lib/utils";

interface Props {
  bouquet: PortfolioBouquet;
  onDelete?: (b: PortfolioBouquet) => void;
  onSelect?: (b: PortfolioBouquet) => void;
  selectable?: boolean;
  selected?: boolean;
  cta?: string;
}

export function BouquetCard({ bouquet, onDelete, onSelect, selectable, selected, cta }: Props) {
  const { t } = useTranslation();
  return (
    <div
      className={`paper-card overflow-hidden rounded-xl group transition-all ${
        selectable ? "cursor-pointer" : ""
      } ${selected ? "ring-2 ring-rose-deep ring-offset-2 ring-offset-background" : ""}`}
      onClick={() => selectable && onSelect?.(bouquet)}
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        <img
          src={bouquet.image}
          alt={bouquet.name}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute left-2 top-2">
          <ColorDots tags={bouquet.color_tags} />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink/60 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-cream">
          <div>
            <h4 className="font-display text-xl leading-tight">{bouquet.name}</h4>
            <div className="text-xs opacity-90">{formatPrice(bouquet.price)}</div>
          </div>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-sm text-muted-foreground line-clamp-2">{bouquet.description}</p>
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {t("bouquet_card.flower_kind", { count: bouquet.composition.length })}
          </div>
          <div className="flex gap-2">
            {onDelete && (
              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onDelete(bouquet); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {cta && onSelect && (
              <Button size="sm" variant="soft" onClick={(e) => { e.stopPropagation(); onSelect(bouquet); }}>
                {cta}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

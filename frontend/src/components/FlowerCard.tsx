import { Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Flower } from "@/api/types";
import { ColorDots } from "./ColorTagPicker";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { formatPrice } from "@/lib/utils";

interface Props {
  flower: Flower;
  onEdit?: (f: Flower) => void;
  onDelete?: (f: Flower) => void;
  readOnly?: boolean;
}

export function FlowerCard({ flower, onEdit, onDelete, readOnly }: Props) {
  const { t } = useTranslation();
  return (
    <div className="paper-card overflow-hidden rounded-xl group">
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={flower.image}
          alt={flower.name}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute left-2 top-2">
          <ColorDots tags={flower.color_tags} />
        </div>
        {flower.quantity === 0 && (
          <div className="absolute inset-0 grid place-items-center bg-ink/40">
            <Badge variant="destructive">{t("flower_card.out_of_stock")}</Badge>
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-display text-lg leading-tight">{flower.name}</h4>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {t("flower_card.qty_unit", { n: flower.quantity })}
          </span>
        </div>
        {flower.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{flower.description}</p>
        )}
        <div className="flex items-end justify-between pt-1">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("flower_card.per_stem")}</div>
            <div className="font-display text-xl text-rose-deep">
              {formatPrice(flower.price_per_stem)}
            </div>
          </div>
          {!readOnly && (
            <div className="flex gap-1">
              {onEdit && (
                <Button size="icon" variant="ghost" onClick={() => onEdit(flower)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button size="icon" variant="ghost" onClick={() => onDelete(flower)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

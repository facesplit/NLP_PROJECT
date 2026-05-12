import { useTranslation } from "react-i18next";
import { Minus, Plus, Check } from "lucide-react";
import type { Flower } from "@/api/types";
import { Button } from "./ui/button";
import { ColorDots } from "./ColorTagPicker";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface ManualSelection {
  flower_id: string;
  quantity: number;
}

interface Props {
  flowers: Flower[];
  selection: ManualSelection[];
  onChange: (s: ManualSelection[]) => void;
  /** Layout density: "compact" for sidebar, "wide" for the result column. */
  density?: "compact" | "wide";
}

export function ManualFlowerPicker({
  flowers,
  selection,
  onChange,
  density = "wide",
}: Props) {
  const { t } = useTranslation();

  const qtyFor = (id: string) =>
    selection.find((s) => s.flower_id === id)?.quantity ?? 0;

  const setQty = (id: string, qty: number) => {
    const filtered = selection.filter((s) => s.flower_id !== id);
    if (qty > 0) filtered.push({ flower_id: id, quantity: qty });
    onChange(filtered);
  };

  return (
    <div
      className={cn(
        "grid gap-3",
        density === "wide"
          ? "grid-cols-2 md:grid-cols-3"
          : "grid-cols-1",
      )}
    >
      {flowers.map((f) => {
        const qty = qtyFor(f.id);
        const sold_out = f.quantity <= 0;
        const selected = qty > 0;
        return (
          <div
            key={f.id}
            className={cn(
              "group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all",
              selected
                ? "border-rose-deep/60 ring-2 ring-rose-deep/20 shadow-sm"
                : "border-border hover:border-rose/50",
              sold_out && "opacity-50",
            )}
          >
            <div className="relative aspect-square w-full overflow-hidden bg-cream">
              {f.image && (
                <img
                  src={f.image}
                  alt={f.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              )}
              {selected && (
                <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-rose-deep text-white shadow-md">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
              <div className="absolute left-2 bottom-2">
                <ColorDots tags={f.color_tags} max={3} />
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-2 p-3">
              <div className="min-w-0">
                <div className="truncate font-medium leading-tight text-sm">
                  {f.name}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {formatPrice(f.price_per_stem)} · {t("generate.manual.in_stock", { n: f.quantity })}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-7 w-7 shrink-0"
                  disabled={qty === 0 || sold_out}
                  onClick={() => setQty(f.id, Math.max(0, qty - 1))}
                  aria-label="-"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <input
                  type="number"
                  min={0}
                  max={f.quantity}
                  value={qty}
                  onChange={(e) => {
                    const n = Math.max(0, Math.min(f.quantity, Number(e.target.value) || 0));
                    setQty(f.id, n);
                  }}
                  className="h-7 w-full min-w-0 rounded-md border border-input bg-card text-center text-sm tabular-nums outline-none focus:border-rose"
                  disabled={sold_out}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-7 w-7 shrink-0"
                  disabled={sold_out || qty >= f.quantity}
                  onClick={() => setQty(f.id, Math.min(f.quantity, qty + 1))}
                  aria-label="+"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

import { useTranslation } from "react-i18next";
import { COLOR_LABELS, COLOR_SWATCH, COLOR_TAGS, type ColorTag } from "@/api/types";
import { cn } from "@/lib/utils";

interface Props {
  value: ColorTag[];
  onChange: (next: ColorTag[]) => void;
  options?: ColorTag[];
  size?: "sm" | "md";
}

export function ColorTagPicker({ value, onChange, options = COLOR_TAGS, size = "md" }: Props) {
  const { t: tr } = useTranslation();
  const toggle = (t: ColorTag) => {
    if (value.includes(t)) onChange(value.filter((x) => x !== t));
    else onChange([...value, t]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((t) => {
        const active = value.includes(t);
        const swatch = COLOR_SWATCH[t];
        const isGradient = swatch.startsWith("linear");
        return (
          <button
            key={t}
            type="button"
            onClick={() => toggle(t)}
            className={cn(
              "group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-all",
              size === "sm" && "px-2.5 py-1 text-xs",
              active
                ? "border-rose-deep bg-rose-soft text-rose-deep shadow-sm"
                : "border-border bg-card/60 text-foreground hover:border-rose/50 hover:bg-cream",
            )}
          >
            <span
              className={cn(
                "h-3 w-3 rounded-full ring-1 ring-border",
                size === "sm" && "h-2.5 w-2.5",
              )}
              style={isGradient ? { background: swatch } : { backgroundColor: swatch }}
            />
            {tr(`colors.${t}`, COLOR_LABELS[t])}
          </button>
        );
      })}
    </div>
  );
}

export function ColorDots({ tags, max = 4 }: { tags: ColorTag[]; max?: number }) {
  const show = tags.slice(0, max);
  return (
    <div className="flex -space-x-1">
      {show.map((t) => {
        const swatch = COLOR_SWATCH[t];
        const isGradient = swatch.startsWith("linear");
        return (
          <span
            key={t}
            className="h-3.5 w-3.5 rounded-full border-2 border-card"
            style={isGradient ? { background: swatch } : { backgroundColor: swatch }}
            title={COLOR_LABELS[t]}
          />
        );
      })}
    </div>
  );
}

import { useTranslation } from "react-i18next";
import type { ArrangementType } from "@/api/api";
import { cn } from "@/lib/utils";

interface ArrangementPickerProps {
  value: ArrangementType | null;
  onChange: (v: ArrangementType) => void;
}

const ITEMS: { type: ArrangementType; tone: string }[] = [
  { type: "handheld", tone: "from-rose-soft via-rose-soft to-cream" },
  { type: "vase", tone: "from-cream via-cream to-rose-soft/40" },
  { type: "centerpiece", tone: "from-rose-soft/40 via-cream to-cream" },
];

export function ArrangementPicker({ value, onChange }: ArrangementPickerProps) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {ITEMS.map(({ type, tone }) => {
        const selected = value === type;
        return (
          <button
            type="button"
            key={type}
            onClick={() => onChange(type)}
            className={cn(
              "group relative flex flex-col overflow-hidden rounded-2xl border bg-card text-left transition-all",
              selected
                ? "border-rose-deep ring-2 ring-rose-deep/30 shadow-md"
                : "border-border hover:border-rose hover:shadow-sm",
            )}
            aria-pressed={selected}
          >
            <div
              className={cn(
                "relative flex h-32 items-center justify-center bg-gradient-to-br",
                tone,
              )}
            >
              <ArrangementIcon type={type} />
            </div>
            <div className="space-y-1 p-3">
              <div className="font-display text-lg leading-tight">
                {t(`generate.step1.${type}`)}
              </div>
              <p className="text-xs text-muted-foreground leading-snug">
                {t(`generate.step1.${type}_desc`)}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ArrangementIcon({ type }: { type: ArrangementType }) {
  // Hand-drawn SVG marks — color picks up rose-deep tone
  const stroke = "currentColor";
  const className = "h-16 w-16 text-rose-deep/70";
  if (type === "handheld") {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <path
          d="M22 50 L22 34 Q22 22 32 22 Q42 22 42 34 L42 50"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="26" cy="20" r="4" fill={stroke} />
        <circle cx="32" cy="14" r="4.5" fill={stroke} opacity="0.85" />
        <circle cx="38" cy="20" r="4" fill={stroke} />
        <circle cx="29" cy="24" r="3" fill={stroke} opacity="0.7" />
        <circle cx="35" cy="24" r="3" fill={stroke} opacity="0.7" />
        <path
          d="M18 50 L46 50 L42 56 L22 56 Z"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill={stroke}
          fillOpacity="0.08"
        />
      </svg>
    );
  }
  if (type === "vase") {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <circle cx="26" cy="14" r="4" fill={stroke} opacity="0.85" />
        <circle cx="32" cy="9" r="4.5" fill={stroke} />
        <circle cx="38" cy="14" r="4" fill={stroke} opacity="0.85" />
        <path
          d="M22 22 L32 14 M42 22 L32 14 M32 14 L32 38"
          stroke={stroke}
          strokeWidth="1.2"
        />
        <path
          d="M24 38 L40 38 L42 56 Q32 60 22 56 Z"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill={stroke}
          fillOpacity="0.12"
        />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <circle cx="20" cy="28" r="4" fill={stroke} opacity="0.8" />
      <circle cx="28" cy="22" r="4.5" fill={stroke} />
      <circle cx="36" cy="22" r="4.5" fill={stroke} opacity="0.85" />
      <circle cx="44" cy="28" r="4" fill={stroke} opacity="0.8" />
      <path
        d="M14 38 Q32 30 50 38 L48 50 L16 50 Z"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill={stroke}
        fillOpacity="0.12"
      />
      <line x1="14" y1="56" x2="50" y2="56" stroke={stroke} strokeWidth="1" opacity="0.6" />
    </svg>
  );
}

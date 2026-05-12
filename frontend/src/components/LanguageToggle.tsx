import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

const LANGS = [
  { code: "ru", label: "RU" },
  { code: "en", label: "EN" },
] as const;

export function LanguageToggle({ className }: { className?: string }) {
  const { i18n, t } = useTranslation();
  const current = i18n.language?.slice(0, 2) ?? "ru";

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-border/60 bg-card/40 p-0.5",
        className,
      )}
      role="group"
      aria-label={t("header.language_aria")}
    >
      {LANGS.map((l) => (
        <Button
          key={l.code}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void i18n.changeLanguage(l.code)}
          className={cn(
            "h-7 rounded-full px-3 text-xs uppercase tracking-wider",
            current === l.code
              ? "bg-rose-soft text-rose-deep hover:bg-rose-soft"
              : "text-muted-foreground",
          )}
        >
          {l.label}
        </Button>
      ))}
    </div>
  );
}

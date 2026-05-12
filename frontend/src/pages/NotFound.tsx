import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Sprig } from "@/components/Sprig";

export function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <Sprig className="h-12 w-12 text-rose/60" />
      <h1 className="font-display text-5xl">{t("not_found.title")}</h1>
      <p className="text-muted-foreground max-w-md">
        {t("not_found.text")}
      </p>
      <Button asChild className="mt-2">
        <Link to="/">{t("not_found.cta")}</Link>
      </Button>
    </div>
  );
}

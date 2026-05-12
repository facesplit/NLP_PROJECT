import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Header } from "./Header";
import { Sprig } from "./Sprig";

export function Layout() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-10 animate-fade-in">
        <Outlet />
      </main>
      <footer className="border-t border-border/60 bg-card/40 py-8">
        <div className="container flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Sprig className="h-4 w-4 text-rose/70" />
            <span className="font-display text-base text-foreground">Bouquet</span>
            <span>—</span>
            <span>{t("layout.footer.tagline")}</span>
          </div>
          <div className="flex items-center gap-4">
            <span>{t("layout.footer.copyright", { year: new Date().getFullYear() })}</span>
            <span className="hidden sm:inline opacity-60">{t("layout.footer.demo_mode")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { api } from "@/api";
import { Input } from "@/components/ui/input";
import { PointCard } from "@/components/PointCard";
import { EmptyState } from "@/components/EmptyState";
import { Sprig } from "@/components/Sprig";
import { Button } from "@/components/ui/button";

export function Search() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const { data: points = [], isLoading } = useQuery({
    queryKey: ["points", q],
    queryFn: () => api.points.listPublic(q),
  });

  return (
    <div className="space-y-10">
      {/* Editorial hero */}
      <section className="relative overflow-hidden rounded-2xl">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_1fr] paper-card">
          <div className="space-y-5 px-8 py-10 lg:px-12 lg:py-14">
            <div className="inline-flex items-center gap-2 rounded-full bg-rose-soft px-3 py-1 text-xs uppercase tracking-[0.32em] text-rose-deep">
              <Sprig className="h-3 w-3" /> {t("consumer.search.kicker")}
            </div>
            <h1 className="font-display text-5xl lg:text-6xl leading-[0.95] tracking-tight">
              {t("consumer.search.title_part1")}{" "}
              <span className="display-italic text-rose-deep">{t("consumer.search.title_workshop")}</span>
              <br />
              {t("consumer.search.title_part2")}{" "}
              <span className="display-italic text-rose-deep">{t("consumer.search.title_with_history")}</span>.
            </h1>
            <p className="max-w-md text-muted-foreground text-balance">
              {t("consumer.search.subtitle")}
            </p>
            <div className="relative max-w-md">
              <SearchIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("consumer.search.search_placeholder")}
                className="h-12 pl-10 pr-4 text-base"
              />
            </div>
          </div>
          <div className="relative hidden lg:block">
            <img
              src="https://picsum.photos/seed/search-hero/900/700"
              alt={t("consumer.search.hero_alt")}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-transparent to-paper/30" />
          </div>
        </div>
      </section>

      <div className="ornament-divider">
        <span className="text-xs uppercase tracking-[0.32em]">{t("consumer.search.divider")}</span>
      </div>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="paper-card aspect-[16/10] animate-pulse rounded-xl" />
          ))}
        </div>
      ) : points.length === 0 ? (
        <EmptyState
          title={t("consumer.search.empty_title")}
          description={t("consumer.search.empty_text")}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {points.map((p) => (
            <PointCard key={p.id} point={p} />
          ))}
        </div>
      )}

      <section className="paper-card relative overflow-hidden rounded-2xl">
        <div className="grid gap-0 md:grid-cols-[1fr_1fr]">
          <img
            src="https://picsum.photos/seed/cta-ai/700/500"
            alt={t("consumer.search.ai_kicker")}
            className="h-full w-full object-cover"
          />
          <div className="space-y-3 p-8">
            <div className="text-xs uppercase tracking-[0.32em] text-rose-deep">{t("consumer.search.ai_kicker")}</div>
            <h2 className="font-display text-3xl">
              {t("consumer.search.ai_title_part1")}{" "}
              <span className="display-italic text-rose-deep">{t("consumer.search.ai_title_mood")}</span>.
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("consumer.search.ai_text")}
            </p>
            <Button asChild variant="soft">
              <Link to="/profile/orders">
                <Sparkles className="h-3.5 w-3.5" />
                {t("consumer.search.ai_cta")}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

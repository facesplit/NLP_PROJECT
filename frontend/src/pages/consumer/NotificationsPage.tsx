import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { api } from "@/api";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { notificationTitle, notificationBody } from "@/notifications/NotificationProvider";
import { useNotifications } from "@/notifications/useNotifications";
import { formatDateTime } from "@/lib/utils";
import type { AppNotification } from "@/api/types";

export function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { setUnread } = useNotifications();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.notifications.list(),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markAll = useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      setUnread(0);
    },
  });

  // Auto-mark all as read when this page is visited (gentle)
  useEffect(() => {
    if (notes.some((n) => !n.is_read)) {
      // mark them all read on load
      markAll.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes.length]);

  const dateLocale = i18n.language?.startsWith("en") ? "en-US" : "ru-RU";

  const groups = useMemo(() => {
    const map = new Map<string, AppNotification[]>();
    for (const n of notes) {
      const key = new Date(n.created_at).toLocaleDateString(dateLocale, {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      const list = map.get(key) ?? [];
      list.push(n);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [notes, dateLocale]);

  const orderId = (n: AppNotification): string | null => {
    const v = (n.payload as Record<string, unknown>).order_id;
    return typeof v === "string" ? v : null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">{t("consumer.notifications.kicker")}</p>
          <h1 className="font-display text-4xl">{t("consumer.notifications.title")}</h1>
        </div>
        <Button variant="outline" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
          <CheckCheck className="h-4 w-4" /> {t("consumer.notifications.mark_all")}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("consumer.notifications.loading")}</p>
      ) : notes.length === 0 ? (
        <EmptyState
          title={t("consumer.notifications.empty_title")}
          description={t("consumer.notifications.empty_text")}
        />
      ) : (
        <div className="space-y-8">
          {groups.map(([day, items]) => (
            <section key={day} className="space-y-3">
              <div className="ornament-divider">
                <span className="text-xs uppercase tracking-[0.32em]">{day}</span>
              </div>
              <ul className="space-y-2">
                {items.map((n) => {
                  const oid = orderId(n);
                  const inner = (
                    <>
                      <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${n.is_read ? "bg-cream text-muted-foreground" : "bg-rose-soft text-rose-deep"}`}>
                        <Bell className="h-4 w-4" />
                      </span>
                      <div className="flex-1">
                        <div className="font-display text-lg leading-tight">{notificationTitle(t, n.type)}</div>
                        <div className="text-sm text-muted-foreground">{notificationBody(t, n)}</div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(n.created_at)}
                      </div>
                    </>
                  );
                  const cls = `paper-card flex items-start gap-3 rounded-xl p-4 transition-all ${oid ? "hover:-translate-y-0.5 hover:shadow-md" : ""} ${
                    n.is_read ? "" : "ring-1 ring-rose/30"
                  }`;
                  return (
                    <li key={n.id}>
                      {oid ? (
                        <Link
                          to={`/orders/${oid}`}
                          className={cls}
                          onClick={() => !n.is_read && markRead.mutate(n.id)}
                        >
                          {inner}
                        </Link>
                      ) : (
                        <div
                          className={cls}
                          onClick={() => !n.is_read && markRead.mutate(n.id)}
                        >
                          {inner}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

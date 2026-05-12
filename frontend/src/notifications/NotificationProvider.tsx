import { createContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useAuth } from "@/auth/useAuth";
import { api, onNotification, startNotificationStream } from "@/api";
import type { AppNotification, NotificationType } from "@/api/types";

interface NotificationContextValue {
  unread: number;
  setUnread: (n: number | ((prev: number) => number)) => void;
}

export const NotificationContext = createContext<NotificationContextValue | null>(null);

export function notificationTitle(t: TFunction, type: NotificationType): string {
  return t(`notifications.title.${type}`);
}

export function notificationBody(t: TFunction, n: AppNotification): string {
  const p = n.payload as Record<string, unknown>;
  if (n.type === "role_changed") {
    return t("notifications.body.role_changed", { role: String(p.new_role) });
  }
  const point = p.point_name ? `«${String(p.point_name)}»` : t("notifications.body.point_default");
  if (n.type === "order_declined") {
    return t("notifications.body.order_declined", {
      point,
      reason: String(p.reason ?? t("notifications.body.no_reason")),
    });
  }
  if (n.type === "order_rejected_by_client") {
    return t("notifications.body.order_rejected_by_client", {
      point,
      reason: String(p.reason ?? t("notifications.body.no_comment")),
    });
  }
  if (n.type === "order_cancelled_by_florist") {
    return t("notifications.body.order_cancelled_by_florist", {
      point,
      reason: String(p.reason ?? t("notifications.body.no_comment")),
    });
  }
  return t(`notifications.body.${n.type}`, { point });
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const count = await api.notifications.unreadCount();
        if (!cancelled) setUnread(count);
      } catch {
        /* ignore */
      }
    })();

    const stop = startNotificationStream();
    const off = onNotification((n) => {
      const title = notificationTitle(t, n.type);
      toast(title, { description: notificationBody(t, n) });
      setUnread((u) => u + 1);
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    });

    return () => {
      cancelled = true;
      off();
      stop();
    };
  }, [user, qc, t]);

  return (
    <NotificationContext.Provider value={{ unread, setUnread }}>
      {children}
    </NotificationContext.Provider>
  );
}

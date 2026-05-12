import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, ShoppingBag, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { api, ApiError } from "@/api";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Profile() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const schema = z.object({
    display_name: z.string().min(2, t("auth.validation.name_min")),
    phone: z.string().optional(),
  });
  type Vals = z.infer<typeof schema>;

  const form = useForm<Vals>({
    resolver: zodResolver(schema),
    values: { display_name: user?.display_name ?? "", phone: user?.phone ?? "" },
  });

  const mut = useMutation({
    mutationFn: (vals: Vals) => api.auth.updateMe(vals),
    onSuccess: async () => {
      await refresh();
      qc.invalidateQueries();
      setEditing(false);
      toast.success(t("consumer.profile.updated_toast"));
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t("consumer.profile.error_default")),
  });

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">{t("consumer.profile.kicker")}</p>
        <h1 className="font-display text-4xl">{t("consumer.profile.greeting")} <span className="display-italic text-rose-deep">{user.display_name.split(" ")[0]}</span></h1>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <div className="paper-card rounded-2xl p-7 space-y-5">
          {editing ? (
            <form onSubmit={form.handleSubmit((v) => mut.mutate(v))} className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("consumer.profile.name")}</Label>
                <Input {...form.register("display_name")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("consumer.profile.phone")}</Label>
                <Input {...form.register("phone")} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={mut.isPending}>
                  {mut.isPending ? t("consumer.profile.saving") : t("consumer.profile.save")}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  {t("consumer.profile.cancel")}
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-rose-soft text-2xl font-display text-rose-deep">
                  {user.display_name.split(" ").map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
                </span>
                <div>
                  <div className="font-display text-2xl">{user.display_name}</div>
                  <div className="text-sm text-muted-foreground font-mono">{user.email}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("consumer.profile.phone")}</div>
                  <div className="mt-1">{user.phone ?? t("consumer.profile.phone_empty")}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("consumer.profile.role_label")}</div>
                  <div className="mt-1">{t("consumer.profile.role_consumer")}</div>
                </div>
              </div>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> {t("consumer.profile.edit")}
              </Button>
            </>
          )}
        </div>

        <div className="space-y-4">
          <Link
            to="/profile/orders"
            className="group paper-card flex items-center gap-4 rounded-2xl p-5 transition-all hover:-translate-y-0.5"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-rose-soft text-rose-deep">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <div className="font-display text-xl">{t("consumer.profile.history_title")}</div>
              <div className="text-sm text-muted-foreground">{t("consumer.profile.history_subtitle")}</div>
            </div>
          </Link>
          <Link
            to="/profile/notifications"
            className="group paper-card flex items-center gap-4 rounded-2xl p-5 transition-all hover:-translate-y-0.5"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-sage/15 text-sage">
              <Bell className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <div className="font-display text-xl">{t("consumer.profile.notifications_title")}</div>
              <div className="text-sm text-muted-foreground">{t("consumer.profile.notifications_subtitle")}</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

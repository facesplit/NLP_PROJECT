import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Plus, MapPin, Star, Flower2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { api, ApiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageUpload } from "@/components/ImageUpload";
import { EmptyState } from "@/components/EmptyState";

export function PointsList() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const schema = z.object({
    name: z.string().min(2, t("florist.points_list.validation.name_min")),
    address: z.string().min(2, t("florist.points_list.validation.address_min")),
    description: z.string().optional(),
    cover_image: z.string().nullable().optional(),
  });
  type Vals = z.infer<typeof schema>;

  const { data: points = [], isLoading } = useQuery({
    queryKey: ["florist", "points"],
    queryFn: () => api.points.listMine(),
  });

  const form = useForm<Vals>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", address: "", description: "", cover_image: null },
  });

  const create = useMutation({
    mutationFn: (vals: Vals) =>
      api.points.create({
        name: vals.name,
        address: vals.address,
        description: vals.description,
        cover_image: vals.cover_image ?? null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["florist", "points"] });
      setOpen(false);
      form.reset();
      toast.success(t("florist.points_list.create_toast"));
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t("florist.points_list.error_default")),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">{t("florist.points_list.kicker")}</p>
          <h1 className="font-display text-4xl">{t("florist.points_list.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("florist.points_list.subtitle")}
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> {t("florist.points_list.create")}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("florist.points_list.loading")}</p>
      ) : points.length === 0 ? (
        <EmptyState
          title={t("florist.points_list.empty_title")}
          description={t("florist.points_list.empty_text")}
          action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {t("florist.points_list.create_short")}</Button>}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {points.map((p) => (
            <Link
              key={p.id}
              to={`/florist/points/${p.id}`}
              className="paper-card overflow-hidden rounded-xl group transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                {p.cover_image ? (
                  <img
                    src={p.cover_image}
                    alt={p.name}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-rose-soft to-cream" />
                )}
                <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-card/95 px-2.5 py-1 text-xs font-medium shadow">
                  <Star className="h-3 w-3 fill-rose-deep text-rose-deep" />
                  {p.rating.toFixed(1)}
                </div>
              </div>
              <div className="space-y-2 p-5">
                <h3 className="font-display text-2xl leading-tight">{p.name}</h3>
                <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 text-rose/70" />
                  <span className="line-clamp-1">{p.address}</span>
                </div>
                <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Flower2 className="h-3.5 w-3.5 text-sage" />
                    {t("florist.points_list.flowers_count", { count: p.flower_count })}
                  </span>
                  <span className="text-border">·</span>
                  <span>{t("florist.points_list.bouquets_count", { count: p.portfolio_count })}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("florist.points_list.dialog.title")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-4">
            <ImageUpload
              value={form.watch("cover_image") ?? null}
              onChange={(d) => form.setValue("cover_image", d)}
              aspect="wide"
              hint={t("florist.points_list.dialog.image_hint")}
            />
            <div className="space-y-1.5">
              <Label>{t("florist.points_list.dialog.name")}</Label>
              <Input {...form.register("name")} placeholder={t("florist.points_list.dialog.name_placeholder")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t("florist.points_list.dialog.address")}</Label>
              <Input {...form.register("address")} placeholder={t("florist.points_list.dialog.address_placeholder")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("florist.points_list.dialog.description")}</Label>
              <Textarea {...form.register("description")} placeholder={t("florist.points_list.dialog.description_placeholder")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("florist.points_list.dialog.cancel")}</Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? t("florist.points_list.dialog.creating") : t("florist.points_list.dialog.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

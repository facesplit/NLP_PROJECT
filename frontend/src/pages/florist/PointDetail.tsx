import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Star, MapPin, ChevronLeft, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageUpload } from "@/components/ImageUpload";
import { ColorTagPicker } from "@/components/ColorTagPicker";
import { FlowerCard } from "@/components/FlowerCard";
import { BouquetCard } from "@/components/BouquetCard";
import { EmptyState } from "@/components/EmptyState";
import type { ColorTag, Flower } from "@/api/types";
import { formatPrice } from "@/lib/utils";

export function PointDetailFlorist() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: point } = useQuery({
    queryKey: ["florist", "point", id],
    queryFn: () => api.points.get(id!),
    enabled: !!id,
  });

  const { data: flowers = [] } = useQuery({
    queryKey: ["florist", "flowers", id],
    queryFn: () => api.flowers.list(id!),
    enabled: !!id,
  });

  const { data: portfolio = [] } = useQuery({
    queryKey: ["florist", "portfolio", id],
    queryFn: () => api.portfolio.list(id!),
    enabled: !!id,
  });

  const updateCover = useMutation({
    mutationFn: (cover: string | null) => api.points.update(id!, { cover_image: cover }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["florist", "point", id] });
      toast.success(t("florist.point_detail.cover_updated_toast"));
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t("florist.point_detail.error_default")),
  });

  const removeFlower = useMutation({
    mutationFn: (fid: string) => api.flowers.remove(id!, fid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["florist", "flowers", id] });
      toast.success(t("florist.point_detail.flower_removed_toast"));
    },
  });

  const removePortfolio = useMutation({
    mutationFn: (pid: string) => api.portfolio.remove(id!, pid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["florist", "portfolio", id] });
      toast.success(t("florist.point_detail.bouquet_removed_toast"));
    },
  });

  const [flowerOpen, setFlowerOpen] = useState(false);
  const [editFlower, setEditFlower] = useState<Flower | null>(null);
  const [bouquetOpen, setBouquetOpen] = useState(false);

  if (!point) return <p className="text-muted-foreground">{t("florist.point_detail.loading")}</p>;

  return (
    <div className="space-y-8">
      <Button variant="ghost" size="sm" onClick={() => navigate("/florist/points")}>
        <ChevronLeft className="h-4 w-4" /> {t("florist.point_detail.back")}
      </Button>

      {/* Hero */}
      <div className="paper-card relative overflow-hidden rounded-2xl">
        <div className="grid gap-0 md:grid-cols-[1fr_1.4fr]">
          <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[280px] bg-cream/60">
            {point.cover_image ? (
              <img src={point.cover_image} alt={point.name} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-rose-soft to-cream" />
            )}
            <label className="absolute right-3 bottom-3 cursor-pointer rounded-full bg-card/95 px-3 py-1.5 text-xs font-medium shadow hover:bg-card">
              {t("florist.point_detail.change_cover")}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = () => updateCover.mutate(String(reader.result));
                  reader.readAsDataURL(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="space-y-3 p-7">
            <div className="flex items-center gap-2 text-sm">
              <Star className="h-4 w-4 fill-rose-deep text-rose-deep" />
              <span className="font-medium">{point.rating.toFixed(1)}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {t("florist.point_detail.stats", { flowers: flowers.length, bouquets: portfolio.length })}
              </span>
            </div>
            <h1 className="font-display text-4xl">{point.name}</h1>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-rose/70" />
              {point.address}
            </div>
            {point.description && (
              <p className="text-sm text-muted-foreground max-w-prose">{point.description}</p>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="flowers">
        <div className="flex items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="flowers">{t("florist.point_detail.tabs.flowers")}</TabsTrigger>
            <TabsTrigger value="portfolio">{t("florist.point_detail.tabs.portfolio")}</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button variant="soft" onClick={() => setBouquetOpen(true)}>
              <Plus className="h-4 w-4" /> {t("florist.point_detail.add_bouquet")}
            </Button>
            <Button onClick={() => setFlowerOpen(true)}>
              <Plus className="h-4 w-4" /> {t("florist.point_detail.add_flower")}
            </Button>
          </div>
        </div>

        <TabsContent value="flowers">
          {flowers.length === 0 ? (
            <EmptyState
              title={t("florist.point_detail.empty_flowers_title")}
              description={t("florist.point_detail.empty_flowers_text")}
              action={<Button onClick={() => setFlowerOpen(true)}><Plus className="h-4 w-4" /> {t("florist.point_detail.add")}</Button>}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {flowers.map((f) => (
                <FlowerCard
                  key={f.id}
                  flower={f}
                  onEdit={(f) => setEditFlower(f)}
                  onDelete={(f) => {
                    if (confirm(t("florist.point_detail.confirm_remove_flower", { name: f.name }))) removeFlower.mutate(f.id);
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="portfolio">
          {portfolio.length === 0 ? (
            <EmptyState
              title={t("florist.point_detail.empty_portfolio_title")}
              description={t("florist.point_detail.empty_portfolio_text")}
              action={<Button onClick={() => setBouquetOpen(true)}><Plus className="h-4 w-4" /> {t("florist.point_detail.add_bouquet")}</Button>}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {portfolio.map((b) => (
                <BouquetCard
                  key={b.id}
                  bouquet={b}
                  onDelete={(b) => {
                    if (confirm(t("florist.point_detail.confirm_remove_bouquet", { name: b.name }))) removePortfolio.mutate(b.id);
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <FlowerDialog
        open={flowerOpen || !!editFlower}
        existing={editFlower}
        onOpenChange={(o) => {
          if (!o) {
            setFlowerOpen(false);
            setEditFlower(null);
          }
        }}
        pointId={id!}
      />
      <PortfolioDialog
        open={bouquetOpen}
        onOpenChange={setBouquetOpen}
        flowers={flowers}
        pointId={id!}
      />
    </div>
  );
}

function makeFlowerSchema(t: TFunction) {
  return z.object({
    name: z.string().min(2),
    image: z.string().min(10, t("florist.point_detail.flower_dialog.image_required")),
    price_per_stem: z.coerce.number().min(0),
    quantity: z.coerce.number().int().min(0),
    color_tags: z.array(z.custom<ColorTag>()).min(1, t("florist.point_detail.flower_dialog.color_tags_required")),
    description: z.string().optional(),
  });
}
type FlowerVals = z.infer<ReturnType<typeof makeFlowerSchema>>;

function FlowerDialog({
  open,
  onOpenChange,
  existing,
  pointId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existing: Flower | null;
  pointId: string;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const flowerSchema = makeFlowerSchema(t);
  const form = useForm<FlowerVals>({
    resolver: zodResolver(flowerSchema),
    values: existing
      ? {
          name: existing.name,
          image: existing.image,
          price_per_stem: existing.price_per_stem,
          quantity: existing.quantity,
          color_tags: existing.color_tags,
          description: existing.description ?? "",
        }
      : {
          name: "",
          image: "",
          price_per_stem: 500,
          quantity: 10,
          color_tags: [],
          description: "",
        },
  });

  const mut = useMutation({
    mutationFn: (vals: FlowerVals) =>
      existing
        ? api.flowers.update(pointId, existing.id, vals)
        : api.flowers.create(pointId, vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["florist", "flowers", pointId] });
      onOpenChange(false);
      toast.success(existing ? t("florist.point_detail.flower_dialog.updated_toast") : t("florist.point_detail.flower_dialog.added_toast"));
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t("florist.point_detail.error_default")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{existing ? t("florist.point_detail.flower_dialog.title_edit") : t("florist.point_detail.flower_dialog.title_new")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => mut.mutate(v))} className="grid gap-4 md:grid-cols-[200px_1fr]">
          <div>
            <ImageUpload
              value={form.watch("image") || null}
              onChange={(d) => form.setValue("image", d ?? "", { shouldValidate: true })}
            />
            {form.formState.errors.image && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.image.message}</p>
            )}
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("florist.point_detail.flower_dialog.name")}</Label>
              <Input {...form.register("name")} placeholder={t("florist.point_detail.flower_dialog.name_placeholder")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("florist.point_detail.flower_dialog.price_per_stem")}</Label>
                <Input type="number" {...form.register("price_per_stem")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("florist.point_detail.flower_dialog.quantity")}</Label>
                <Input type="number" {...form.register("quantity")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("florist.point_detail.flower_dialog.color_tags")}</Label>
              <ColorTagPicker
                value={form.watch("color_tags")}
                onChange={(v) => form.setValue("color_tags", v, { shouldValidate: true })}
              />
              {form.formState.errors.color_tags && (
                <p className="text-xs text-destructive">{form.formState.errors.color_tags.message as string}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t("florist.point_detail.flower_dialog.description")}</Label>
              <Textarea {...form.register("description")} placeholder={t("florist.point_detail.flower_dialog.description_placeholder")} />
            </div>
            <DialogFooter className="md:col-span-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("florist.point_detail.flower_dialog.cancel")}</Button>
              <Button type="submit" disabled={mut.isPending}>
                {mut.isPending ? t("florist.point_detail.flower_dialog.saving") : existing ? t("florist.point_detail.flower_dialog.save") : t("florist.point_detail.flower_dialog.add")}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function makeBouquetSchema(t: TFunction) {
  return z.object({
    name: z.string().min(2),
    description: z.string().min(2),
    image: z.string().min(10, t("florist.point_detail.bouquet_dialog.image_required")),
    price: z.coerce.number().min(1),
    color_tags: z.array(z.custom<ColorTag>()).min(1),
    composition: z.array(z.object({ flower_id: z.string().min(1), quantity: z.coerce.number().int().min(1) })).min(1, t("florist.point_detail.bouquet_dialog.composition_required")),
  });
}
type BouquetVals = z.infer<ReturnType<typeof makeBouquetSchema>>;

function PortfolioDialog({
  open,
  onOpenChange,
  flowers,
  pointId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  flowers: Flower[];
  pointId: string;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const bouquetSchema = makeBouquetSchema(t);
  const form = useForm<BouquetVals>({
    resolver: zodResolver(bouquetSchema),
    defaultValues: {
      name: "",
      description: "",
      image: "",
      price: 10000,
      color_tags: [],
      composition: [],
    },
  });

  const mut = useMutation({
    mutationFn: (vals: BouquetVals) =>
      api.portfolio.create(pointId, {
        ...vals,
        composition: vals.composition,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["florist", "portfolio", pointId] });
      onOpenChange(false);
      form.reset();
      toast.success(t("florist.point_detail.bouquet_dialog.added_toast"));
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t("florist.point_detail.error_default")),
  });

  const composition = form.watch("composition");
  const addRow = () => {
    if (flowers.length === 0) return;
    form.setValue("composition", [...composition, { flower_id: flowers[0].id, quantity: 3 }], { shouldValidate: true });
  };
  const removeRow = (idx: number) =>
    form.setValue(
      "composition",
      composition.filter((_, i) => i !== idx),
      { shouldValidate: true },
    );

  const total = composition.reduce((sum, row) => {
    const f = flowers.find((x) => x.id === row.flower_id);
    return sum + (f?.price_per_stem ?? 0) * row.quantity;
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("florist.point_detail.bouquet_dialog.title")}</DialogTitle>
        </DialogHeader>
        {flowers.length === 0 ? (
          <p className="rounded-md bg-cream p-4 text-sm text-muted-foreground">
            {t("florist.point_detail.bouquet_dialog.no_flowers")}
          </p>
        ) : (
          <form onSubmit={form.handleSubmit((v) => mut.mutate(v))} className="grid gap-4 md:grid-cols-[220px_1fr]">
            <div>
              <ImageUpload
                value={form.watch("image") || null}
                onChange={(d) => form.setValue("image", d ?? "", { shouldValidate: true })}
              />
              {form.formState.errors.image && (
                <p className="mt-1 text-xs text-destructive">{form.formState.errors.image.message}</p>
              )}
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t("florist.point_detail.bouquet_dialog.name")}</Label>
                <Input {...form.register("name")} placeholder={t("florist.point_detail.bouquet_dialog.name_placeholder")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("florist.point_detail.bouquet_dialog.description")}</Label>
                <Textarea {...form.register("description")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("florist.point_detail.bouquet_dialog.price")}</Label>
                  <Input type="number" {...form.register("price")} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("florist.point_detail.bouquet_dialog.calc_total")}</Label>
                  <div className="h-10 rounded-md border border-dashed border-border bg-cream/40 px-3 grid place-items-center text-sm text-muted-foreground">
                    {formatPrice(total)}
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("florist.point_detail.bouquet_dialog.color_tags")}</Label>
                <ColorTagPicker
                  value={form.watch("color_tags")}
                  onChange={(v) => form.setValue("color_tags", v, { shouldValidate: true })}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>{t("florist.point_detail.bouquet_dialog.composition")}</Label>
                  <Button type="button" size="sm" variant="ghost" onClick={addRow}>
                    <Plus className="h-3 w-3" /> {t("florist.point_detail.bouquet_dialog.add_flower")}
                  </Button>
                </div>
                <div className="space-y-2">
                  {composition.length === 0 && (
                    <p className="text-xs text-muted-foreground">{t("florist.point_detail.bouquet_dialog.composition_empty")}</p>
                  )}
                  {composition.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Select
                        value={row.flower_id}
                        onValueChange={(v) =>
                          form.setValue(
                            "composition",
                            composition.map((r, i) => (i === idx ? { ...r, flower_id: v } : r)),
                            { shouldValidate: true },
                          )
                        }
                      >
                        <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {flowers.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.name} — {formatPrice(f.price_per_stem)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        className="w-24"
                        value={row.quantity}
                        onChange={(e) =>
                          form.setValue(
                            "composition",
                            composition.map((r, i) =>
                              i === idx ? { ...r, quantity: Number(e.target.value) || 0 } : r,
                            ),
                            { shouldValidate: true },
                          )
                        }
                      />
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeRow(idx)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                {form.formState.errors.composition && (
                  <p className="text-xs text-destructive">{form.formState.errors.composition.message as string}</p>
                )}
              </div>
              <DialogFooter className="md:col-span-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("florist.point_detail.bouquet_dialog.cancel")}</Button>
                <Button type="submit" disabled={mut.isPending}>
                  {mut.isPending ? t("florist.point_detail.bouquet_dialog.saving") : t("florist.point_detail.bouquet_dialog.add")}
                </Button>
              </DialogFooter>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

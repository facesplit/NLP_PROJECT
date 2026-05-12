import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RotateCcw, Save, X, Cpu, Wand2, ImageIcon, Coins, Thermometer } from "lucide-react";
import { useTranslation } from "react-i18next";

import { api, ApiError, type AIConfig, type AIConfigPatch } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";

const SAMPLER_OPTIONS = [
  { value: "euler", label: "euler — fastest, balanced" },
  { value: "euler_ancestral", label: "euler_ancestral — more variation" },
  { value: "dpmpp_2m", label: "dpmpp_2m — higher fidelity" },
  { value: "dpmpp_sde", label: "dpmpp_sde — slow, very detailed" },
  { value: "ddim", label: "ddim — deterministic" },
  { value: "lcm", label: "lcm — fastest, low quality" },
];

type FormState = {
  system_prompt: string;
  negative_prompt: string;
  sampler_steps: string;
  sampler_cfg: string;
  sampler_name: string;
  image_width: string;
  image_height: string;
  budget_lower_pct: string;
  budget_upper_pct: string;
  llm_temperature: string;
  llm_max_retries: string;
  max_references: string;
  pipeline_version: "sd15" | "sdxl";
};

const toForm = (cfg: AIConfig): FormState => ({
  system_prompt: cfg.system_prompt,
  negative_prompt: cfg.negative_prompt,
  sampler_steps: String(cfg.sampler_steps),
  sampler_cfg: String(cfg.sampler_cfg),
  sampler_name: cfg.sampler_name,
  image_width: String(cfg.image_width),
  image_height: String(cfg.image_height),
  budget_lower_pct: String(cfg.budget_lower_pct),
  budget_upper_pct: String(cfg.budget_upper_pct),
  llm_temperature: String(cfg.llm_temperature),
  llm_max_retries: String(cfg.llm_max_retries),
  max_references: String(cfg.max_references),
  pipeline_version: cfg.pipeline_version,
});

const buildPatch = (form: FormState, original: AIConfig): AIConfigPatch => {
  const patch: AIConfigPatch = {};
  if (form.system_prompt !== original.system_prompt) patch.system_prompt = form.system_prompt;
  if (form.negative_prompt !== original.negative_prompt) patch.negative_prompt = form.negative_prompt;
  const steps = Number(form.sampler_steps);
  if (steps !== original.sampler_steps) patch.sampler_steps = steps;
  const cfg = Number(form.sampler_cfg);
  if (cfg !== original.sampler_cfg) patch.sampler_cfg = cfg;
  if (form.sampler_name !== original.sampler_name) patch.sampler_name = form.sampler_name;
  const w = Number(form.image_width);
  if (w !== original.image_width) patch.image_width = w;
  const h = Number(form.image_height);
  if (h !== original.image_height) patch.image_height = h;
  const lo = Number(form.budget_lower_pct);
  if (lo !== original.budget_lower_pct) patch.budget_lower_pct = lo;
  const hi = Number(form.budget_upper_pct);
  if (hi !== original.budget_upper_pct) patch.budget_upper_pct = hi;
  const temp = Number(form.llm_temperature);
  if (temp !== original.llm_temperature) patch.llm_temperature = temp;
  const retries = Number(form.llm_max_retries);
  if (retries !== original.llm_max_retries) patch.llm_max_retries = retries;
  const refs = Number(form.max_references);
  if (refs !== original.max_references) patch.max_references = refs;
  if (form.pipeline_version !== original.pipeline_version) patch.pipeline_version = form.pipeline_version;
  return patch;
};

export function AIConfigPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: cfg, isLoading } = useQuery({
    queryKey: ["admin", "ai-config"],
    queryFn: () => api.admin.aiConfig.get(),
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    if (cfg) setForm(toForm(cfg));
  }, [cfg]);

  const dirty = useMemo(() => {
    if (!cfg || !form) return false;
    return Object.keys(buildPatch(form, cfg)).length > 0;
  }, [cfg, form]);

  const patch = useMutation({
    mutationFn: (input: AIConfigPatch) => api.admin.aiConfig.patch(input),
    onSuccess: (next) => {
      qc.setQueryData(["admin", "ai-config"], next);
      setForm(toForm(next));
      toast.success(t("superadmin.ai_config.save_toast"));
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError && err.details && typeof err.details === "object"
          ? `${(err.details as { field?: string }).field ?? ""}: ${(err.details as { reason?: string }).reason ?? err.message}`
          : err instanceof Error
            ? err.message
            : t("superadmin.ai_config.save_error");
      toast.error(msg);
    },
  });

  const reset = useMutation({
    mutationFn: () => api.admin.aiConfig.reset(),
    onSuccess: (next) => {
      qc.setQueryData(["admin", "ai-config"], next);
      setForm(toForm(next));
      setResetOpen(false);
      toast.success(t("superadmin.ai_config.reset_toast"));
    },
    onError: () => toast.error(t("superadmin.ai_config.reset_error")),
  });

  if (isLoading || !cfg || !form) {
    return (
      <div className="space-y-6">
        <div className="paper-card h-32 animate-pulse rounded-xl" />
        <div className="paper-card h-96 animate-pulse rounded-xl" />
      </div>
    );
  }

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => (f ? { ...f, [key]: e.target.value } : f));

  const handleSave = () => {
    if (!cfg || !form) return;
    const p = buildPatch(form, cfg);
    if (Object.keys(p).length === 0) return;
    patch.mutate(p);
  };

  const handleCancel = () => {
    if (cfg) setForm(toForm(cfg));
  };

  return (
    <div className="space-y-6 pb-32">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">{t("superadmin.ai_config.kicker")}</p>
          <h1 className="font-display text-4xl">{t("superadmin.ai_config.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("superadmin.ai_config.subtitle")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/80">
            {t("superadmin.ai_config.updated", { date: formatDate(cfg.updated_at) })}
          </p>
        </div>
      </div>

      <section className="paper-card space-y-4 rounded-xl p-6">
        <header className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-soft text-rose-deep">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-2xl">{t("superadmin.ai_config.pipeline.title")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("superadmin.ai_config.pipeline.subtitle")}
            </p>
          </div>
        </header>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pipeline_version">{t("superadmin.ai_config.pipeline.version_label")}</Label>
            <Select
              value={form.pipeline_version}
              onValueChange={(v) =>
                setForm((f) => (f ? { ...f, pipeline_version: v as "sd15" | "sdxl" } : f))
              }
            >
              <SelectTrigger id="pipeline_version">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sdxl">{t("superadmin.ai_config.pipeline.version_sdxl")}</SelectItem>
                <SelectItem value="sd15">{t("superadmin.ai_config.pipeline.version_sd15")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="paper-card space-y-4 rounded-xl p-6">
        <header className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-soft text-rose-deep">
            <Wand2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-2xl">{t("superadmin.ai_config.system_prompt.title")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("superadmin.ai_config.system_prompt.subtitle")}
            </p>
          </div>
        </header>
        <Textarea
          value={form.system_prompt}
          onChange={set("system_prompt")}
          rows={16}
          className="font-mono text-xs"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("superadmin.ai_config.system_prompt.counter", { count: form.system_prompt.length })}</span>
        </div>
      </section>

      <section className="paper-card space-y-4 rounded-xl p-6">
        <header className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-soft text-rose-deep">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-2xl">{t("superadmin.ai_config.sd.title")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("superadmin.ai_config.sd.subtitle")}
            </p>
          </div>
        </header>

        <div className="space-y-2">
          <Label htmlFor="negative_prompt">{t("superadmin.ai_config.sd.negative_label")}</Label>
          <Textarea
            id="negative_prompt"
            value={form.negative_prompt}
            onChange={set("negative_prompt")}
            rows={3}
            className="font-mono text-xs"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="sampler_name">{t("superadmin.ai_config.sd.sampler_label")}</Label>
            <Select
              value={form.sampler_name}
              onValueChange={(v) => setForm((f) => (f ? { ...f, sampler_name: v } : f))}
            >
              <SelectTrigger id="sampler_name">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SAMPLER_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sampler_steps">{t("superadmin.ai_config.sd.steps_label")}</Label>
            <Input
              id="sampler_steps"
              type="number"
              min={1}
              max={150}
              value={form.sampler_steps}
              onChange={set("sampler_steps")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sampler_cfg">{t("superadmin.ai_config.sd.cfg_label")}</Label>
            <Input
              id="sampler_cfg"
              type="number"
              step="0.1"
              min={1}
              max={30}
              value={form.sampler_cfg}
              onChange={set("sampler_cfg")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="image_width">{t("superadmin.ai_config.sd.width_label")}</Label>
            <Input
              id="image_width"
              type="number"
              min={128}
              max={2048}
              step={8}
              value={form.image_width}
              onChange={set("image_width")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="image_height">{t("superadmin.ai_config.sd.height_label")}</Label>
            <Input
              id="image_height"
              type="number"
              min={128}
              max={2048}
              step={8}
              value={form.image_height}
              onChange={set("image_height")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max_references">{t("superadmin.ai_config.sd.max_refs_label")}</Label>
            <Input
              id="max_references"
              type="number"
              min={1}
              max={10}
              value={form.max_references}
              onChange={set("max_references")}
            />
            <p className="text-xs text-muted-foreground">
              {t("superadmin.ai_config.sd.max_refs_hint")}
            </p>
          </div>
        </div>
      </section>

      <section className="paper-card space-y-4 rounded-xl p-6">
        <header className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-soft text-rose-deep">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-2xl">{t("superadmin.ai_config.budget.title")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("superadmin.ai_config.budget.subtitle")}
            </p>
          </div>
        </header>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="budget_lower_pct">{t("superadmin.ai_config.budget.lower_label")}</Label>
            <Input
              id="budget_lower_pct"
              type="number"
              step="0.01"
              min={0.1}
              max={5.0}
              value={form.budget_lower_pct}
              onChange={set("budget_lower_pct")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget_upper_pct">{t("superadmin.ai_config.budget.upper_label")}</Label>
            <Input
              id="budget_upper_pct"
              type="number"
              step="0.01"
              min={0.1}
              max={5.0}
              value={form.budget_upper_pct}
              onChange={set("budget_upper_pct")}
            />
          </div>
        </div>
      </section>

      <section className="paper-card space-y-4 rounded-xl p-6">
        <header className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-soft text-rose-deep">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-2xl">{t("superadmin.ai_config.llm.title")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("superadmin.ai_config.llm.subtitle")}
            </p>
          </div>
        </header>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="llm_temperature">
              <Thermometer className="mr-1.5 inline h-3.5 w-3.5" />
              {t("superadmin.ai_config.llm.temp_label")}
            </Label>
            <Input
              id="llm_temperature"
              type="number"
              step="0.05"
              min={0}
              max={2}
              value={form.llm_temperature}
              onChange={set("llm_temperature")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="llm_max_retries">{t("superadmin.ai_config.llm.retries_label")}</Label>
            <Input
              id="llm_max_retries"
              type="number"
              min={1}
              max={20}
              value={form.llm_max_retries}
              onChange={set("llm_max_retries")}
            />
          </div>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-paper/85 backdrop-blur-md">
        <div className="container flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="text-xs text-muted-foreground">
            {dirty ? (
              <span className="text-rose-deep">{t("superadmin.ai_config.footer.dirty")}</span>
            ) : (
              <span>{t("superadmin.ai_config.footer.clean")}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setResetOpen(true)} disabled={reset.isPending}>
              <RotateCcw className="h-4 w-4" /> {t("superadmin.ai_config.footer.reset")}
            </Button>
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={!dirty || patch.isPending}>
              <X className="h-4 w-4" /> {t("superadmin.ai_config.footer.cancel")}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!dirty || patch.isPending}>
              <Save className="h-4 w-4" /> {patch.isPending ? t("superadmin.ai_config.footer.saving") : t("superadmin.ai_config.footer.save")}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("superadmin.ai_config.reset_dialog.title")}</DialogTitle>
            <DialogDescription>
              {t("superadmin.ai_config.reset_dialog.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              {t("superadmin.ai_config.reset_dialog.cancel")}
            </Button>
            <Button onClick={() => reset.mutate()} disabled={reset.isPending}>
              {reset.isPending ? t("superadmin.ai_config.reset_dialog.resetting") : t("superadmin.ai_config.reset_dialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

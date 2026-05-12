import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";

import { api, ApiError } from "@/api";
import type { ArrangementType } from "@/api/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { ColorTagPicker } from "@/components/ColorTagPicker";
import { Sprig } from "@/components/Sprig";
import { Stepper } from "@/components/Stepper";
import { ArrangementPicker } from "@/components/ArrangementPicker";
import {
  ManualFlowerPicker,
  type ManualSelection,
} from "@/components/ManualFlowerPicker";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { AIVariant, ColorTag } from "@/api/types";

const TOTAL_STEPS = 3;
const CONTAINER_CHIPS = ["kraft", "ceramic", "glass", "silk", "rustic", "minimal", "romantic"] as const;

export function Generate() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useTranslation();

  const { data: point } = useQuery({
    queryKey: ["point", id],
    queryFn: () => api.points.get(id!),
    enabled: !!id,
  });

  const { data: stockFlowers, isLoading: stockLoading } = useQuery({
    queryKey: ["point", id, "flowers"],
    queryFn: () => api.flowers.list(id!),
    enabled: !!id,
  });

  // Wizard state
  const [step, setStep] = useState(0); // 0..2
  // Highest step the user has explicitly completed (pressed "Next" from). Starts at -1
  // so only step 0 is reachable on first load. Forward jumps in the stepper are locked
  // beyond `furthestCompleted + 1` regardless of default form validity.
  const [furthestCompleted, setFurthestCompleted] = useState(-1);
  const [arrangementType, setArrangementType] = useState<ArrangementType | null>(null);
  const [containerStyle, setContainerStyle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [colors, setColors] = useState<ColorTag[]>([]);
  const [budget, setBudget] = useState(15000);
  const [aiAssistant, setAiAssistant] = useState(true);
  const [manualSelection, setManualSelection] = useState<ManualSelection[]>([]);

  // Result state
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [message, setMessage] = useState("");
  const toastedFor = useRef<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ["ai", "generation", generationId],
    queryFn: () => api.ai.getStatus(generationId!),
    enabled: !!generationId,
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return 2000;
      return data.status === "pending" ? 2000 : false;
    },
  });

  const variants: AIVariant[] = statusQuery.data?.variants ?? [];
  const globalStatus = statusQuery.data?.status ?? null;
  const globalError = statusQuery.data?.error_message ?? null;
  const allFailed =
    variants.length > 0 && variants.every((v) => v.status === "failed");
  // Index of the variant the user has chosen to order (null = not picking yet).
  const [pickedIdx, setPickedIdx] = useState<number | null>(null);
  const pickedVariant: AIVariant | undefined =
    pickedIdx != null ? variants[pickedIdx] : undefined;
  // For UI labelling we still expose the first variant's error if every variant failed.
  const variantError = variants[0]?.error ?? null;

  const generate = useMutation({
    mutationFn: () => {
      const composition =
        !aiAssistant
          ? manualSelection.map((s) => ({ flower_id: s.flower_id, quantity: s.quantity }))
          : null;
      return api.ai.generate({
        point_id: id!,
        prompt: prompt.trim() || (aiAssistant ? "" : "Manual composition"),
        color_tags: colors.length > 0 ? colors : ["mixed"],
        budget,
        arrangement_type: arrangementType,
        container_style: containerStyle.trim() || null,
        mode: aiAssistant ? "ai" : "manual",
        composition,
      });
    },
    onMutate: () => {
      setBusy(true);
      setGenerationId(null);
      toastedFor.current = null;
    },
    onSuccess: (res) => {
      setGenerationId(res.generation_id);
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : t("generate.submit_failed");
      toast.error(msg);
    },
    onSettled: () => setBusy(false),
  });

  const order = useMutation({
    mutationFn: () =>
      api.orders.create({
        point_id: id!,
        source: "ai_generated",
        ai_generation_id: generationId!,
        ai_variant_index: pickedIdx ?? 0,
        client_message: message,
      }),
    onSuccess: (o) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success(t("generate.order_sent_title"), {
        description: t("generate.order_sent_desc"),
      });
      navigate(`/orders/${o.id}`);
    },
    onError: (e) => {
      const isApiErr = e instanceof ApiError;
      if (
        isApiErr &&
        (e.details as { subcode?: string })?.subcode === "VARIANT_NOT_READY"
      ) {
        toast.error(t("generate.order_already_pending"));
        return;
      }
      toast.error(isApiErr ? e.message : t("generate.order_failed"));
    },
  });

  // Toast on first failed transition
  useEffect(() => {
    if (!generationId) return;
    const isFailed = globalStatus === "failed" || allFailed;
    if (isFailed && toastedFor.current !== generationId) {
      toastedFor.current = generationId;
      toast.error(t("generate.failed_default"), {
        description: variantError || globalError || undefined,
      });
    }
  }, [generationId, globalStatus, allFailed, variantError, globalError, t]);

  // First-mount defaults
  useEffect(() => {
    if (!arrangementType) setArrangementType("handheld");
    if (colors.length === 0) setColors(["pink", "white"]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const manualTotal = useMemo(() => {
    if (!stockFlowers) return 0;
    return manualSelection.reduce((sum, s) => {
      const f = stockFlowers.find((x) => x.id === s.flower_id);
      return f ? sum + f.price_per_stem * s.quantity : sum;
    }, 0);
  }, [manualSelection, stockFlowers]);

  const manualStems = manualSelection.reduce((s, x) => s + x.quantity, 0);

  const stepValid = (s: number) => {
    if (s === 0) return !!arrangementType;
    if (s === 1) return true; // Style is optional
    if (s === 2) {
      if (aiAssistant) return colors.length > 0 && budget >= 1000;
      return manualSelection.length > 0 && budget >= 1000;
    }
    return false;
  };

  // Highest contiguously-valid step (used to cap furthestCompleted if user goes back
  // and invalidates an earlier step).
  const lastValidContiguous = (() => {
    let last = -1;
    for (let i = 0; i < TOTAL_STEPS; i++) {
      if (stepValid(i)) last = i;
      else break;
    }
    return last;
  })();

  // Reachable step in the stepper = furthestCompleted + 1 (the next to-do),
  // capped by what's still actually valid.
  const furthestReachable = Math.max(
    0,
    Math.min(furthestCompleted + 1, lastValidContiguous + 1, TOTAL_STEPS - 1),
  );

  // If user breaks an earlier step's validity, retreat completion marker.
  useEffect(() => {
    if (furthestCompleted > lastValidContiguous) {
      setFurthestCompleted(lastValidContiguous);
    }
  }, [furthestCompleted, lastValidContiguous]);

  // If current step becomes unreachable (e.g. user toggled AI mode and step 2 lost validity),
  // slide back to a reachable one.
  useEffect(() => {
    if (step > furthestReachable) setStep(furthestReachable);
  }, [step, furthestReachable]);

  const goNext = () => {
    if (!stepValid(step) || step >= TOTAL_STEPS - 1) return;
    setFurthestCompleted((f) => Math.max(f, step));
    setStep(step + 1);
  };

  const canSubmit = stepValid(0) && stepValid(2);
  const isCollecting = busy || globalStatus === "pending";
  const isFailed = globalStatus === "failed" || allFailed;

  const stepLabels = [
    t("generate.step1.name"),
    t("generate.step2.name"),
    t("generate.step3.name"),
  ];

  return (
    <div className="space-y-8">
      <Button variant="ghost" size="sm" onClick={() => navigate(`/points/${id}`)}>
        <ChevronLeft className="h-4 w-4" /> {t("generate.back_to_workshop")}
      </Button>

      <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
        {/* LEFT: wizard */}
        <aside className="paper-card sticky top-24 self-start rounded-2xl p-6 space-y-5 max-h-[calc(100vh-7rem)] overflow-y-auto">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-rose-deep">
              {t("generate.kicker")}
            </p>
            <h2 className="font-display text-3xl mt-1">
              {t("generate.title_describe")}{" "}
              <span className="display-italic">{t("generate.title_mood")}</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {point ? (
                <>
                  {t("generate.point_label")}{" "}
                  <span className="text-foreground">{point.name}</span>
                </>
              ) : (
                "…"
              )}
            </p>
          </div>

          {/* AI assistant toggle */}
          <div
            className={cn(
              "flex items-start gap-3 rounded-xl border p-3 transition-colors",
              aiAssistant
                ? "border-rose-deep/30 bg-rose-soft/40"
                : "border-border bg-card/40",
            )}
          >
            <Wand2
              className={cn(
                "mt-0.5 h-5 w-5 shrink-0",
                aiAssistant ? "text-rose-deep" : "text-muted-foreground",
              )}
            />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{t("generate.ai_assistant")}</span>
                <Switch
                  checked={aiAssistant}
                  onCheckedChange={(v) => {
                    setAiAssistant(v);
                    if (v) setManualSelection([]);
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                {aiAssistant
                  ? t("generate.ai_assistant_on_hint")
                  : t("generate.ai_assistant_off_hint")}
              </p>
            </div>
          </div>

          {/* Stepper */}
          <Stepper
            steps={stepLabels.map((label, i) => ({ key: `s${i}`, label }))}
            current={step}
            onJump={(i) => setStep(i)}
            furthest={furthestReachable}
          />

          <div className="space-y-4">
            {step === 0 && (
              <div className="space-y-3">
                <div>
                  <h3 className="font-display text-xl">{t("generate.step1.title")}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t("generate.step1.subtitle")}
                  </p>
                </div>
                <ArrangementPicker value={arrangementType} onChange={setArrangementType} />
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3">
                <div>
                  <h3 className="font-display text-xl">{t("generate.step2.title")}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t("generate.step2.subtitle")}
                  </p>
                </div>
                <Textarea
                  value={containerStyle}
                  onChange={(e) => setContainerStyle(e.target.value)}
                  rows={4}
                  placeholder={t("generate.step2.placeholder")}
                />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">
                    {t("generate.step2.chips_label")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {CONTAINER_CHIPS.map((key) => {
                      const label = t(`generate.step2.chips.${key}`);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            const cur = containerStyle.trim();
                            setContainerStyle(cur ? `${cur}, ${label}` : label);
                          }}
                          className="rounded-full border border-border bg-card/60 px-2.5 py-1 text-xs hover:border-rose hover:bg-cream transition-colors"
                        >
                          + {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-display text-xl">
                    {aiAssistant
                      ? t("generate.step3.title")
                      : t("generate.manual.title")}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {aiAssistant
                      ? t("generate.step3.subtitle")
                      : t("generate.manual.subtitle")}
                  </p>
                </div>

                {aiAssistant ? (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {t("generate.step3.prompt_label")}
                      </label>
                      <Textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        rows={3}
                        placeholder={t("generate.step3.prompt_placeholder")}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {t("generate.step3.colors_label")}
                      </label>
                      <ColorTagPicker value={colors} onChange={setColors} />
                    </div>
                  </>
                ) : (
                  // Manual mode: the actual flower grid is rendered in the RIGHT column
                  // (more horizontal space). Sidebar shows only a summary.
                  <ManualSummary
                    stems={manualStems}
                    price={manualTotal}
                    hasSelection={manualSelection.length > 0}
                  />
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <span>{t("generate.step3.budget_label")}</span>
                    <span className="font-display text-2xl text-rose-deep tracking-normal normal-case">
                      {formatPrice(budget)}
                    </span>
                  </div>
                  <Slider
                    value={[budget]}
                    onValueChange={(v) => setBudget(v[0])}
                    min={5000}
                    max={60000}
                    step={500}
                  />
                  <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>5 000 ₸</span>
                    <span>60 000 ₸</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Step navigation */}
          <div className="flex gap-2 pt-2">
            {step > 0 && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep(step - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                {t("common.back")}
              </Button>
            )}
            {step < TOTAL_STEPS - 1 ? (
              <Button
                className="flex-1"
                disabled={!stepValid(step)}
                onClick={goNext}
              >
                {t("common.next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                className="flex-1"
                size="lg"
                disabled={!canSubmit || isCollecting}
                onClick={() => generate.mutate()}
              >
                {isCollecting ? (
                  <>
                    <Sparkles className="h-4 w-4 animate-pulse" />
                    {t("generate.collecting")}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {generationId
                      ? t("generate.submit_ai_again")
                      : aiAssistant
                        ? t("generate.submit_ai")
                        : t("generate.submit_manual")}
                  </>
                )}
              </Button>
            )}
          </div>
        </aside>

        {/* RIGHT: idle state, manual-mode warehouse picker, or generation result. */}
        <section className="space-y-6 min-w-0">
          {!generationId && !busy && step === 2 && !aiAssistant ? (
            <ManualWarehousePanel
              loading={stockLoading}
              flowers={stockFlowers ?? []}
              selection={manualSelection}
              onChange={setManualSelection}
            />
          ) : !generationId && !busy ? (
            <div className="paper-card rounded-2xl p-12 text-center space-y-3 max-w-md mx-auto">
              <Sprig className="mx-auto h-12 w-12 text-rose/60" />
              <h3 className="display-italic text-3xl text-rose-deep">
                {t("generate.ready_idle_title")}
              </h3>
              <p className="text-muted-foreground">{t("generate.ready_idle_text")}</p>
            </div>
          ) : null}

          {/* In-flight, no variant inserted yet — slim status pill. */}
          {generationId && variants.length === 0 && isCollecting && (
            <div className="paper-card rounded-2xl px-6 py-5 inline-flex items-center gap-3 justify-center mx-auto">
              <RefreshCw className="h-4 w-4 animate-spin text-rose-deep" />
              <span className="text-sm text-muted-foreground">{t("generate.blooming")}</span>
            </div>
          )}

          {/* Single composite preview — image on top, details below.
              Lives in the right column next to the wizard, sized to the column width. */}
          {generationId && variants.length > 0 && variants[0] && (() => {
            const v = variants[0];
            if (v.status === "ready") {
              return (
                <article className="paper-card overflow-hidden rounded-3xl animate-bloom">
                  <div className="relative aspect-[4/5] overflow-hidden bg-cream">
                    {v.image && (
                      <img
                        src={v.image}
                        alt={aiAssistant ? t("generate.ai_badge") : t("generate.manual_badge")}
                        className="h-full w-full object-cover"
                      />
                    )}
                    <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-card/95 px-3 py-1.5 text-xs font-medium shadow-sm">
                      <Sparkles className="h-3.5 w-3.5 text-rose-deep" />
                      {aiAssistant ? t("generate.ai_badge") : t("generate.manual_badge")}
                    </div>
                  </div>
                  <div className="flex flex-col gap-5 p-6 md:p-8">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.32em] text-rose-deep">
                        {t("generate.kicker")}
                      </p>
                      <p className="display-italic text-2xl leading-tight text-foreground/85 text-balance mt-2">
                        «{v.explanation}»
                      </p>
                    </div>
                    <ul className="divide-y divide-border/70 rounded-xl bg-cream/40 px-4">
                      {v.composition.map((c) => (
                        <li
                          key={c.flower_id}
                          className="flex items-center justify-between py-2.5 text-sm"
                        >
                          <div>
                            <div className="font-medium leading-tight">{c.name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {c.quantity} × {formatPrice(c.price_per_stem)}
                            </div>
                          </div>
                          <div className="text-sm font-medium">{formatPrice(c.subtotal)}</div>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-end justify-between border-t border-border/60 pt-5">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {t("generate.total")}
                        </div>
                        <div className="font-display text-4xl text-rose-deep leading-none mt-1">
                          {formatPrice(v.total_price)}
                        </div>
                      </div>
                      <Button
                        size="lg"
                        onClick={() => {
                          setPickedIdx(0);
                          setPicking(true);
                        }}
                      >
                        <Send className="h-4 w-4" /> {t("generate.order")}
                      </Button>
                    </div>
                  </div>
                </article>
              );
            }
            if (v.status === "pending") {
              return (
                <article className="paper-card overflow-hidden rounded-3xl">
                  <div className="aspect-[4/5] bg-cream animate-pulse" />
                  <div className="flex items-center justify-center p-8">
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {t("generate.blooming")}
                    </span>
                  </div>
                </article>
              );
            }
            return null;
          })()}

          {generationId && allFailed && (
            <div className="paper-card rounded-2xl p-8 text-center space-y-3">
              <h3 className="font-display text-2xl">{t("generate.failed_title")}</h3>
              <p className="text-sm text-muted-foreground">
                {variantError || globalError || t("generate.failed_default")}
              </p>
              <Button
                variant="outline"
                onClick={() => generate.mutate()}
                disabled={!canSubmit}
              >
                <RefreshCw className="h-4 w-4" /> {t("common.retry")}
              </Button>
            </div>
          )}
        </section>
      </div>

      {/* Order confirm sticky panel */}
      {picking && pickedVariant?.status === "ready" && pickedVariant.image && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-paper/95 backdrop-blur-md shadow-lg">
          <div className="container flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <img
                src={pickedVariant.image}
                alt=""
                className="h-12 w-12 rounded-md object-cover"
              />
              <div>
                <div className="text-xs text-muted-foreground">
                  {aiAssistant
                    ? `${t("generate.ai_badge")} #${(pickedIdx ?? 0) + 1}`
                    : t("generate.manual_badge")}
                </div>
                <div className="font-display text-lg">
                  {formatPrice(pickedVariant.total_price)}
                </div>
              </div>
            </div>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("generate.florist_msg_placeholder")}
              className="h-10 flex-1 rounded-md border border-input bg-card/60 px-3 text-sm outline-none focus:border-rose"
            />
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setPicking(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={() => order.mutate()} disabled={order.isPending}>
                <Send className="h-3.5 w-3.5" />
                {order.isPending ? t("generate.sending") : t("generate.send")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ManualSummary({
  stems,
  price,
  hasSelection,
}: {
  stems: number;
  price: number;
  hasSelection: boolean;
}) {
  const { t } = useTranslation();
  if (!hasSelection) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("generate.manual.no_selection")}
      </p>
    );
  }
  return (
    <div className="rounded-md bg-rose-soft/40 px-3 py-2.5 text-sm text-rose-deep">
      {t("generate.manual.selected_summary", {
        stems,
        price: formatPrice(price),
      })}
    </div>
  );
}

function ManualWarehousePanel({
  loading,
  flowers,
  selection,
  onChange,
}: {
  loading: boolean;
  flowers: import("@/api/types").Flower[];
  selection: ManualSelection[];
  onChange: (s: ManualSelection[]) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="paper-card rounded-2xl p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl">{t("generate.manual.title")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("generate.manual.subtitle")}
          </p>
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">{t("generate.manual.loading")}</p>
      ) : flowers.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("generate.manual.empty")}</p>
      ) : (
        <ManualFlowerPicker
          density="wide"
          flowers={flowers}
          selection={selection}
          onChange={onChange}
        />
      )}
    </div>
  );
}

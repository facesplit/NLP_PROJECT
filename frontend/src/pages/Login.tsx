import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/useAuth";
import { ApiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sprig } from "@/components/Sprig";

export function Login() {
  const { t } = useTranslation();
  const { login, user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";

  const schema = z.object({
    email: z.string().email(t("auth.validation.email_invalid")),
    password: z.string().min(4, t("auth.validation.password_min", { count: 4 })),
  });
  type FormVals = z.infer<typeof schema>;

  const demoAccounts: { label: string; email: string; password: string; tone: string }[] = [
    { label: t("auth.login.demo_superadmin"), email: "admin@bouquet.local", password: "admin12345", tone: "bg-cream text-foreground" },
    { label: t("auth.login.demo_flora"), email: "flora@bouquet.local", password: "flora12345", tone: "bg-rose-soft text-rose-deep" },
    { label: t("auth.login.demo_lily"), email: "lily@bouquet.local", password: "lily12345", tone: "bg-rose-soft text-rose-deep" },
    { label: t("auth.login.demo_client"), email: "client@bouquet.local", password: "client12345", tone: "bg-sage/15 text-sage" },
  ];

  const form = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  if (!loading && user) return <Navigate to={from} replace />;

  const submit = form.handleSubmit(async (values) => {
    setBusy(true);
    try {
      const u = await login(values.email, values.password);
      toast.success(t("auth.login.welcome_toast", { name: u.display_name }));
      navigate(from === "/login" ? "/" : from, { replace: true });
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message);
      else toast.error(t("auth.login.error_default"));
    } finally {
      setBusy(false);
    }
  });

  const fill = (acc: (typeof demoAccounts)[number]) => {
    form.setValue("email", acc.email);
    form.setValue("password", acc.password);
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden lg:block overflow-hidden">
        <img
          src="https://picsum.photos/seed/login-hero/1400/1600"
          alt={t("auth.login.hero_alt")}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-ink/70 via-ink/30 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-between p-12 text-cream">
          <div className="flex items-center gap-2">
            <Sprig className="h-6 w-6" />
            <span className="font-display text-2xl">Bouquet</span>
          </div>
          <div className="max-w-md space-y-4">
            <p className="display-italic text-3xl leading-snug text-balance">
              {t("auth.login.hero_quote")}
            </p>
            <p className="text-sm opacity-80">
              {t("auth.login.hero_subtitle")}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2">
            <Link to="/" className="inline-flex items-center gap-2 text-rose-deep">
              <Sprig className="h-5 w-5" />
              <span className="font-display text-xl">Bouquet</span>
            </Link>
            <h1 className="font-display text-4xl">{t("auth.login.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("auth.login.subtitle")}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("auth.login.email")}</Label>
              <Input id="email" autoComplete="email" {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("auth.login.password")}</Label>
              <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={busy} className="w-full" size="lg">
              {busy ? t("auth.login.submitting") : t("auth.login.submit")}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            {t("auth.login.no_account")}{" "}
            <Link to="/register" className="font-medium text-rose-deep hover:underline">
              {t("auth.login.register_link")}
            </Link>
          </div>

          <div className="space-y-2 rounded-lg border border-dashed border-rose/30 bg-card/40 p-4">
            <div className="flex items-center gap-2">
              <span className="ornament-divider w-full">
                <span className="text-xs uppercase tracking-[0.32em] text-muted-foreground">{t("auth.login.demo_label")}</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => fill(a)}
                  className={`group rounded-md px-3 py-2 text-left text-xs transition hover:scale-[1.01] ${a.tone}`}
                >
                  <div className="font-medium">{a.label}</div>
                  <div className="opacity-70 truncate">{a.email}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

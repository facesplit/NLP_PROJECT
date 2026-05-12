import { Link, Navigate, useNavigate } from "react-router-dom";
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

export function Register() {
  const { t } = useTranslation();
  const { register, user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const schema = z.object({
    email: z.string().email(t("auth.validation.email_invalid")),
    password: z.string().min(6, t("auth.validation.password_min", { count: 6 })),
    display_name: z.string().min(2, t("auth.validation.name_min")),
    phone: z.string().optional(),
  });
  type FormVals = z.infer<typeof schema>;

  const form = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", display_name: "", phone: "" },
  });

  if (!loading && user) return <Navigate to="/" replace />;

  const submit = form.handleSubmit(async (values) => {
    setBusy(true);
    try {
      await register(values);
      toast.success(t("auth.register.success_toast"));
      navigate("/search", { replace: true });
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message);
      else toast.error(t("auth.register.error_default"));
    } finally {
      setBusy(false);
    }
  });

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_1.05fr]">
      <div className="flex items-center justify-center px-6 py-12 lg:px-16 order-2 lg:order-1">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2">
            <Link to="/" className="inline-flex items-center gap-2 text-rose-deep">
              <Sprig className="h-5 w-5" />
              <span className="font-display text-xl">Bouquet</span>
            </Link>
            <h1 className="font-display text-4xl">{t("auth.register.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("auth.register.subtitle")}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="display_name">{t("auth.register.name")}</Label>
              <Input id="display_name" autoComplete="name" {...form.register("display_name")} />
              {form.formState.errors.display_name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.display_name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("auth.register.email")}</Label>
              <Input id="email" autoComplete="email" {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">{t("auth.register.phone")}</Label>
              <Input id="phone" autoComplete="tel" placeholder={t("auth.register.phone_placeholder")} {...form.register("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("auth.register.password")}</Label>
              <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy ? t("auth.register.submitting") : t("auth.register.submit")}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            {t("auth.register.have_account")}{" "}
            <Link to="/login" className="font-medium text-rose-deep hover:underline">
              {t("auth.register.login_link")}
            </Link>
          </div>
        </div>
      </div>

      <div className="relative hidden lg:block overflow-hidden order-1 lg:order-2">
        <img
          src="https://picsum.photos/seed/register-hero/1400/1600"
          alt={t("auth.register.hero_alt")}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-bl from-ink/60 via-ink/20 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-12 text-cream">
          <p className="display-italic text-3xl leading-snug max-w-md text-balance">
            {t("auth.register.hero_quote")}
          </p>
        </div>
      </div>
    </div>
  );
}

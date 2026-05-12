import { Link, NavLink, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, LogOut, ShoppingBag, Sparkles, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/useAuth";
import { useNotifications } from "@/notifications/useNotifications";
import { Button } from "./ui/button";
import { Sprig } from "./Sprig";
import { LanguageToggle } from "./LanguageToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { api } from "@/api";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

export function Header() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { unread, setUnread } = useNotifications();
  const navigate = useNavigate();

  const { data: unreadFromApi } = useQuery({
    queryKey: ["notifications.unread", user?.id],
    queryFn: () => api.notifications.unreadCount(),
    enabled: !!user,
    refetchInterval: 4000,
  });

  useEffect(() => {
    if (typeof unreadFromApi === "number") setUnread(unreadFromApi);
  }, [unreadFromApi, setUnread]);

  const navByRole: Record<string, { to: string; label: string }[]> = {
    superadmin: [
      { to: "/admin/users", label: t("header.nav.users") },
      { to: "/superadmin/ai-config", label: t("header.nav.ai_config") },
    ],
    floristadmin: [
      { to: "/florist/points", label: t("header.nav.points") },
      { to: "/florist/orders", label: t("header.nav.orders") },
    ],
    consumer: [
      { to: "/search", label: t("header.nav.search") },
      { to: "/profile/orders", label: t("header.nav.my_orders") },
    ],
  };

  const links = user ? navByRole[user.role] ?? [] : [];

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-paper/85 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-6">
        <Link to="/" className="flex items-center gap-2.5 group">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-rose-soft text-rose-deep ring-1 ring-rose/30">
            <Sprig className="h-5 w-5 text-rose-deep transition-transform group-hover:rotate-[8deg]" />
          </span>
          <div className="flex flex-col leading-none">
            <span className="font-display text-2xl tracking-tight">Bouquet</span>
            <span className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
              {t("header.brand_tagline")}
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-2">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  "rounded-full px-4 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-rose-soft text-rose-deep"
                    : "text-muted-foreground hover:bg-cream hover:text-foreground",
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageToggle className="hidden sm:inline-flex" />
          {user ? (
            <>
              {user.role === "consumer" && (
                <Button asChild size="sm" variant="soft" className="hidden sm:inline-flex">
                  <Link to="/search">
                    <Sparkles className="h-3.5 w-3.5" />
                    {t("header.cta.find_bouquet")}
                  </Link>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("header.aria.notifications")}
                onClick={() => navigate(notificationsPathFor(user.role))}
                className="relative"
              >
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute right-1.5 top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-deep px-1 text-[10px] font-medium text-primary-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-rose-soft text-xs font-medium text-rose-deep">
                      {initials(user.display_name)}
                    </span>
                    <span className="hidden sm:inline max-w-[140px] truncate">{user.display_name}</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="space-y-0.5">
                      <div className="font-display text-base normal-case tracking-normal text-foreground">
                        {user.display_name}
                      </div>
                      <div className="text-xs normal-case tracking-normal text-muted-foreground">
                        {user.email}
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {user.role === "consumer" && (
                    <>
                      <DropdownMenuItem onSelect={() => navigate("/profile")}>
                        <User className="h-4 w-4" /> {t("header.menu.profile")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => navigate("/profile/orders")}>
                        <ShoppingBag className="h-4 w-4" /> {t("header.menu.my_orders")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onSelect={handleLogout}>
                    <LogOut className="h-4 w-4" /> {t("header.menu.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/login">{t("auth.login.submit")}</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/register">{t("auth.register.submit")}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function notificationsPathFor(role: string) {
  if (role === "consumer") return "/profile/notifications";
  if (role === "floristadmin") return "/florist/orders";
  return "/admin/users";
}

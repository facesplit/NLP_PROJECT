import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Search as SearchIcon, ShieldCheck, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { api, ApiError, type PublicUser } from "@/api";
import type { Role } from "@/api/types";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/EmptyState";
import { formatDate } from "@/lib/utils";

const ROLE_VARIANT: Record<Role, "default" | "soft" | "sage" | "secondary"> = {
  superadmin: "default",
  floristadmin: "soft",
  consumer: "sage",
};

export function UsersTable() {
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [filterRole, setFilterRole] = useState<Role | "all">("all");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PublicUser | null>(null);
  const [deleting, setDeleting] = useState<PublicUser | null>(null);

  const hardDelete = useMutation({
    mutationFn: (id: string) => api.admin.deleteUser(id, { hard: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success(t("admin.users.delete_dialog.success"));
      setDeleting(null);
    },
    onError: (e) => {
      if (e instanceof ApiError) toast.error(e.message);
      else toast.error(t("admin.users.delete_dialog.error"));
    },
  });

  const filters = useMemo(() => ({ role: filterRole, is_active: filterActive, q }), [filterRole, filterActive, q]);
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin", "users", filters],
    queryFn: () => api.admin.listUsers(filters),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">{t("admin.users.kicker")}</p>
          <h1 className="font-display text-4xl">{t("admin.users.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("admin.users.subtitle")}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> {t("admin.users.create")}
        </Button>
      </div>

      <div className="paper-card flex flex-wrap items-center gap-3 rounded-xl p-3">
        <div className="relative flex-1 min-w-[220px]">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
            placeholder={t("admin.users.search_placeholder")}
          />
        </div>
        <Select value={filterRole} onValueChange={(v) => setFilterRole(v as Role | "all")}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.users.filters.all_roles")}</SelectItem>
            <SelectItem value="superadmin">{t("admin.users.role_label.superadmin")}</SelectItem>
            <SelectItem value="floristadmin">{t("admin.users.role_label.floristadmin")}</SelectItem>
            <SelectItem value="consumer">{t("admin.users.role_label.consumer")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterActive} onValueChange={(v) => setFilterActive(v as "all" | "active" | "inactive")}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.users.filters.all_statuses")}</SelectItem>
            <SelectItem value="active">{t("admin.users.filters.active")}</SelectItem>
            <SelectItem value="inactive">{t("admin.users.filters.inactive")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">{t("admin.users.loading")}</div>
      ) : users.length === 0 ? (
        <EmptyState
          title={t("admin.users.empty_title")}
          description={t("admin.users.empty_text")}
        />
      ) : (
        <div className="paper-card overflow-hidden rounded-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-cream/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t("admin.users.table.name")}</th>
                <th className="px-4 py-3 font-medium">{t("admin.users.table.email")}</th>
                <th className="px-4 py-3 font-medium">{t("admin.users.table.role")}</th>
                <th className="px-4 py-3 font-medium">{t("admin.users.table.status")}</th>
                <th className="px-4 py-3 font-medium">{t("admin.users.table.created")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isMe = u.id === me?.id;
                return (
                  <tr
                    key={u.id}
                    className="border-t border-border/60 transition-colors hover:bg-cream/40"
                  >
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-rose-soft text-xs text-rose-deep">
                          {u.display_name
                            .split(" ")
                            .map((s) => s[0])
                            .filter(Boolean)
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </span>
                        <span>{u.display_name}</span>
                        {isMe && <Badge variant="outline">{t("admin.users.table.you_badge")}</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={ROLE_VARIANT[u.role]}>
                        {u.role === "superadmin" && <ShieldCheck className="mr-1 h-3 w-3" />}
                        {t(`admin.users.role_label.${u.role}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {u.is_active ? (
                        <Badge variant="success">{t("admin.users.table.active")}</Badge>
                      ) : (
                        <Badge variant="destructive">{t("admin.users.table.inactive")}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(u)}>
                          <Pencil className="h-3.5 w-3.5" />
                          {t("admin.users.table.edit")}
                        </Button>
                        {!isMe && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleting(u)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t("admin.users.table.delete")}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["admin", "users"] });
          toast.success(t("admin.users.create_dialog.success"));
        }}
      />
      <EditUserDialog
        user={editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onUpdated={() => {
          qc.invalidateQueries({ queryKey: ["admin", "users"] });
          toast.success(t("admin.users.edit_dialog.success"));
          setEditing(null);
        }}
      />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.users.delete_dialog.title")}</DialogTitle>
            <DialogDescription>
              {t("admin.users.delete_dialog.description", { email: deleting?.email ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              {t("admin.users.delete_dialog.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={hardDelete.isPending}
              onClick={() => deleting && hardDelete.mutate(deleting.id)}
            >
              {hardDelete.isPending ? t("admin.users.delete_dialog.deleting") : t("admin.users.delete_dialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  display_name: z.string().min(2),
  phone: z.string().optional(),
  role: z.enum(["superadmin", "floristadmin", "consumer"]),
});
type CreateVals = z.infer<typeof createSchema>;

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const form = useForm<CreateVals>({
    resolver: zodResolver(createSchema),
    defaultValues: { email: "", password: "", display_name: "", phone: "", role: "consumer" },
  });

  const mut = useMutation({
    mutationFn: (vals: CreateVals) => api.admin.createUser({ ...vals, is_active: true }),
    onSuccess: () => {
      form.reset();
      onOpenChange(false);
      onCreated();
    },
    onError: (e) => {
      if (e instanceof ApiError) toast.error(e.message);
      else toast.error(t("admin.users.create_dialog.error"));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.users.create_dialog.title")}</DialogTitle>
          <DialogDescription>{t("admin.users.create_dialog.subtitle")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((v) => mut.mutate(v))}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("admin.users.create_dialog.name")}</Label>
              <Input {...form.register("display_name")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("admin.users.create_dialog.role")}</Label>
              <Select
                value={form.watch("role")}
                onValueChange={(v) => form.setValue("role", v as Role)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="superadmin">{t("admin.users.role_label.superadmin")}</SelectItem>
                  <SelectItem value="floristadmin">{t("admin.users.role_label.floristadmin")}</SelectItem>
                  <SelectItem value="consumer">{t("admin.users.role_label.consumer")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin.users.create_dialog.email")}</Label>
            <Input type="email" {...form.register("email")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("admin.users.create_dialog.phone")}</Label>
              <Input {...form.register("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("admin.users.create_dialog.password")}</Label>
              <Input type="password" {...form.register("password")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("admin.users.create_dialog.cancel")}
            </Button>
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending ? t("admin.users.create_dialog.creating") : t("admin.users.create_dialog.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const editSchema = z.object({
  display_name: z.string().min(2),
  phone: z.string().nullable().optional(),
  is_active: z.boolean(),
  role: z.enum(["superadmin", "floristadmin", "consumer"]),
});
type EditVals = z.infer<typeof editSchema>;

function EditUserDialog({
  user,
  onOpenChange,
  onUpdated,
}: {
  user: PublicUser | null;
  onOpenChange: (o: boolean) => void;
  onUpdated: () => void;
}) {
  const { t } = useTranslation();
  const form = useForm<EditVals>({
    resolver: zodResolver(editSchema),
    values: user
      ? {
          display_name: user.display_name,
          phone: user.phone ?? "",
          is_active: user.is_active,
          role: user.role,
        }
      : undefined,
  });

  const mut = useMutation({
    mutationFn: (vals: EditVals) => api.admin.updateUser(user!.id, vals),
    onSuccess: () => onUpdated(),
    onError: (e) => {
      if (e instanceof ApiError) toast.error(e.message);
      else toast.error(t("admin.users.edit_dialog.error"));
    },
  });

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.users.edit_dialog.title")}</DialogTitle>
          <DialogDescription className="font-mono text-xs">{user?.email}</DialogDescription>
        </DialogHeader>
        {user && (
          <form
            onSubmit={form.handleSubmit((v) => mut.mutate(v))}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label>{t("admin.users.edit_dialog.name")}</Label>
              <Input {...form.register("display_name")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("admin.users.edit_dialog.phone")}</Label>
              <Input {...form.register("phone")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("admin.users.edit_dialog.role")}</Label>
                <Select
                  value={form.watch("role")}
                  onValueChange={(v) => form.setValue("role", v as Role)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="superadmin">{t("admin.users.role_label.superadmin")}</SelectItem>
                    <SelectItem value="floristadmin">{t("admin.users.role_label.floristadmin")}</SelectItem>
                    <SelectItem value="consumer">{t("admin.users.role_label.consumer")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border bg-card/60 p-3">
                <Label className="!normal-case !tracking-normal !text-sm !text-foreground">{t("admin.users.edit_dialog.active")}</Label>
                <Switch
                  checked={form.watch("is_active")}
                  onCheckedChange={(v) => form.setValue("is_active", v)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                {t("admin.users.edit_dialog.cancel")}
              </Button>
              <Button type="submit" disabled={mut.isPending}>
                {mut.isPending ? t("admin.users.edit_dialog.saving") : t("admin.users.edit_dialog.save")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

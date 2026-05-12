import { ApiError, request, setAccessToken } from "./client";
import { mediaUrl } from "@/lib/media";
import type {
  AIConfig,
  AIConfigPatch,
  AIGenerateAccepted,
  AIGeneration,
  AIGenerationStatusResponse,
  AIVariant,
  AppNotification,
  ColorTag,
  Flower,
  FloristPoint,
  Order,
  OrderStatus,
  PointPublic,
  PortfolioBouquet,
  PublicUser,
  Role,
} from "./types";

export { ApiError } from "./client";

/* ============================================================
 * Field adapters: backend uses *_path suffixes; frontend uses
 * `image`/`cover_image` and resolves URLs via mediaUrl().
 * Decimals come back as strings — convert to numbers.
 * ============================================================ */

interface BackendUser {
  id: string;
  email: string;
  role: Role;
  display_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

interface BackendPoint {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  description: string | null;
  cover_image_path: string | null;
  rating: number | string;
  is_active: boolean;
  created_at: string;
  flower_count?: number;
  portfolio_count?: number;
}

interface BackendFlower {
  id: string;
  point_id: string;
  name: string;
  image_path: string;
  price_per_stem: number | string;
  quantity: number;
  color_tags: ColorTag[];
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface BackendPortfolioBouquet {
  id: string;
  point_id: string;
  name: string;
  description: string | null;
  image_path: string;
  price: number | string;
  color_tags: ColorTag[];
  composition: { flower_id: string; quantity: number }[];
  is_active: boolean;
  created_at: string;
}

interface BackendOrder {
  id: string;
  consumer_id: string;
  point_id: string;
  source: "ai_generated" | "portfolio";
  status: OrderStatus;
  total_price: number | string;
  composition_snapshot: {
    flower_id: string;
    name: string;
    price_per_stem: number | string;
    quantity: number;
  }[];
  portfolio_bouquet_id: string | null;
  ai_generation_id: string | null;
  ai_variant_index: number | null;
  client_message: string | null;
  budget: number | string | null;
  result_image_path: string | null;
  decline_reason: string | null;
  rejection_reason: string | null;
  accepted_at: string | null;
  in_progress_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface BackendAIVariant {
  index: number;
  status: "pending" | "ready" | "failed";
  image_path: string | null;
  composition: {
    flower_id: string;
    name: string;
    price_per_stem: number | string;
    quantity: number;
    subtotal: number | string;
  }[];
  total_price: number | string;
  explanation: string;
  error: string | null;
}

interface BackendAIConfig {
  id: number;
  system_prompt: string;
  negative_prompt: string;
  sampler_steps: number;
  sampler_cfg: number | string;
  sampler_name: string;
  image_width: number;
  image_height: number;
  budget_lower_pct: number | string;
  budget_upper_pct: number | string;
  llm_temperature: number | string;
  llm_max_retries: number;
  max_references: number;
  pipeline_version: "sd15" | "sdxl";
  updated_at: string;
  updated_by: string | null;
}

interface BackendAIGeneration {
  id: string;
  consumer_id: string;
  point_id: string;
  prompt: string;
  color_tags: ColorTag[];
  budget: number | string;
  variants: BackendAIVariant[];
  status: "pending" | "ready" | "failed";
  error_message: string | null;
  created_at: string;
}

const num = (v: number | string | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v);
};

const adaptUser = (u: BackendUser): PublicUser => u;

const adaptPoint = (p: BackendPoint): FloristPoint => ({
  id: p.id,
  owner_id: p.owner_id,
  name: p.name,
  address: p.address,
  description: p.description,
  cover_image: mediaUrl(p.cover_image_path),
  rating: num(p.rating),
  is_active: p.is_active,
  created_at: p.created_at,
});

const adaptPointPublic = (p: BackendPoint): PointPublic => ({
  ...adaptPoint(p),
  flower_count: p.flower_count ?? 0,
  portfolio_count: p.portfolio_count ?? 0,
});

const adaptFlower = (f: BackendFlower): Flower => ({
  id: f.id,
  point_id: f.point_id,
  name: f.name,
  image: mediaUrl(f.image_path) ?? "",
  price_per_stem: num(f.price_per_stem),
  quantity: f.quantity,
  color_tags: f.color_tags,
  description: f.description,
  is_active: f.is_active,
  created_at: f.created_at,
});

const adaptBouquet = (b: BackendPortfolioBouquet): PortfolioBouquet => ({
  id: b.id,
  point_id: b.point_id,
  name: b.name,
  description: b.description ?? "",
  image: mediaUrl(b.image_path) ?? "",
  price: num(b.price),
  color_tags: b.color_tags,
  composition: b.composition,
  is_active: b.is_active,
  created_at: b.created_at,
});

const adaptOrder = (o: BackendOrder): Order => ({
  id: o.id,
  consumer_id: o.consumer_id,
  point_id: o.point_id,
  source: o.source,
  status: o.status,
  total_price: num(o.total_price),
  composition_snapshot: o.composition_snapshot.map((c) => ({
    flower_id: c.flower_id,
    name: c.name,
    price_per_stem: num(c.price_per_stem),
    quantity: c.quantity,
  })),
  portfolio_bouquet_id: o.portfolio_bouquet_id,
  ai_generation_id: o.ai_generation_id,
  ai_variant_index: o.ai_variant_index,
  client_message: o.client_message,
  budget: o.budget == null ? null : num(o.budget),
  result_image: mediaUrl(o.result_image_path),
  decline_reason: o.status === "cancelled_by_florist" ? null : o.decline_reason,
  rejection_reason: o.rejection_reason,
  cancel_reason: o.status === "cancelled_by_florist" ? o.decline_reason : null,
  accepted_at: o.accepted_at,
  in_progress_at: o.in_progress_at,
  ready_at: o.ready_at,
  completed_at: o.completed_at,
  created_at: o.created_at,
});

const adaptAIVariant = (v: BackendAIVariant): AIVariant => ({
  index: v.index,
  status: v.status,
  image: mediaUrl(v.image_path),
  composition: v.composition.map((c) => ({
    flower_id: c.flower_id,
    name: c.name,
    price_per_stem: num(c.price_per_stem),
    quantity: c.quantity,
    subtotal: num(c.subtotal),
  })),
  total_price: num(v.total_price),
  explanation: v.explanation,
  error: v.error,
});

const adaptAIConfig = (c: BackendAIConfig): AIConfig => ({
  id: c.id,
  system_prompt: c.system_prompt,
  negative_prompt: c.negative_prompt,
  sampler_steps: c.sampler_steps,
  sampler_cfg: num(c.sampler_cfg),
  sampler_name: c.sampler_name,
  image_width: c.image_width,
  image_height: c.image_height,
  budget_lower_pct: num(c.budget_lower_pct),
  budget_upper_pct: num(c.budget_upper_pct),
  llm_temperature: num(c.llm_temperature),
  llm_max_retries: c.llm_max_retries,
  max_references: c.max_references,
  pipeline_version: c.pipeline_version,
  updated_at: c.updated_at,
  updated_by: c.updated_by,
});

const adaptAIGeneration = (g: BackendAIGeneration): AIGeneration => ({
  id: g.id,
  consumer_id: g.consumer_id,
  point_id: g.point_id,
  prompt: g.prompt,
  color_tags: g.color_tags,
  budget: num(g.budget),
  variants: g.variants.map(adaptAIVariant),
  status: g.status,
  error_message: g.error_message,
  created_at: g.created_at,
});

/* ============================================================
 * Auth
 * ============================================================ */

export const auth = {
  async login(email: string, password: string): Promise<PublicUser> {
    const data = await request<{ access_token: string; user: BackendUser }>(
      "/api/auth/login",
      { method: "POST", body: { email, password }, skipAuth: true, skipRefresh: true },
    );
    setAccessToken(data.access_token);
    return adaptUser(data.user);
  },

  async register(input: {
    email: string;
    password: string;
    display_name: string;
    phone?: string;
  }): Promise<PublicUser> {
    const data = await request<{ access_token: string; user: BackendUser }>(
      "/api/auth/register",
      { method: "POST", body: input, skipAuth: true, skipRefresh: true },
    );
    setAccessToken(data.access_token);
    return adaptUser(data.user);
  },

  async logout(): Promise<void> {
    try {
      await request("/api/auth/logout", { method: "POST", skipRefresh: true });
    } catch {
      /* ignore */
    }
    setAccessToken(null);
  },

  async me(): Promise<PublicUser | null> {
    try {
      const u = await request<BackendUser>("/api/auth/me");
      return adaptUser(u);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  },

  async tryRestoreSession(): Promise<PublicUser | null> {
    try {
      const data = await request<{ access_token: string; user: BackendUser }>(
        "/api/auth/refresh",
        { method: "POST", skipAuth: true, skipRefresh: true },
      );
      setAccessToken(data.access_token);
      return adaptUser(data.user);
    } catch {
      setAccessToken(null);
      return null;
    }
  },

  async updateMe(patch: { display_name?: string; phone?: string | null }): Promise<PublicUser> {
    const u = await request<BackendUser>("/api/auth/me", { method: "PATCH", body: patch });
    return adaptUser(u);
  },
};

/* ============================================================
 * Admin / Users
 * ============================================================ */

export const admin = {
  async listUsers(filters?: {
    role?: Role | "all";
    is_active?: "all" | "active" | "inactive";
    q?: string;
  }): Promise<PublicUser[]> {
    const query: Record<string, string | undefined> = {};
    if (filters?.role && filters.role !== "all") query.role = filters.role;
    if (filters?.is_active && filters.is_active !== "all")
      query.is_active = filters.is_active === "active" ? "true" : "false";
    if (filters?.q) query.q = filters.q;
    const users = await request<BackendUser[]>("/api/admin/users", { query });
    return users.map(adaptUser);
  },

  async createUser(input: {
    email: string;
    password: string;
    role: Role;
    display_name: string;
    phone?: string | null;
    is_active?: boolean;
  }): Promise<PublicUser> {
    const u = await request<BackendUser>("/api/admin/users", { method: "POST", body: input });
    return adaptUser(u);
  },

  async updateUser(
    id: string,
    patch: {
      display_name?: string;
      phone?: string | null;
      is_active?: boolean;
      role?: Role;
      password?: string;
    },
  ): Promise<PublicUser> {
    const u = await request<BackendUser>(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: patch,
    });
    return adaptUser(u);
  },

  async deleteUser(id: string, opts?: { hard?: boolean }): Promise<void> {
    const path = opts?.hard
      ? `/api/admin/users/${id}?hard=true`
      : `/api/admin/users/${id}`;
    await request(path, { method: "DELETE" });
  },

  aiConfig: {
    async get(): Promise<AIConfig> {
      const c = await request<BackendAIConfig>("/api/admin/ai-config");
      return adaptAIConfig(c);
    },
    async patch(input: AIConfigPatch): Promise<AIConfig> {
      const c = await request<BackendAIConfig>("/api/admin/ai-config", {
        method: "PATCH",
        body: input,
      });
      return adaptAIConfig(c);
    },
    async reset(): Promise<AIConfig> {
      const c = await request<BackendAIConfig>("/api/admin/ai-config/reset", {
        method: "POST",
      });
      return adaptAIConfig(c);
    },
  },
};

/* ============================================================
 * Points
 * ============================================================ */

export const points = {
  async listPublic(q?: string): Promise<PointPublic[]> {
    const list = await request<BackendPoint[]>("/api/points", { query: { q }, skipAuth: false });
    return list.map(adaptPointPublic);
  },

  async get(id: string): Promise<PointPublic> {
    const p = await request<BackendPoint>(`/api/points/${id}`);
    return adaptPointPublic(p);
  },

  async listMine(): Promise<PointPublic[]> {
    const list = await request<BackendPoint[]>("/api/me/points");
    return list.map(adaptPointPublic);
  },

  async create(input: {
    name: string;
    address: string;
    description?: string;
    cover_image?: string | null;
  }): Promise<FloristPoint> {
    const p = await request<BackendPoint>("/api/me/points", {
      method: "POST",
      body: {
        name: input.name,
        address: input.address,
        description: input.description ?? null,
        cover_image_path: input.cover_image ?? null,
      },
    });
    return adaptPoint(p);
  },

  async update(
    id: string,
    patch: { name?: string; address?: string; description?: string | null; cover_image?: string | null },
  ): Promise<FloristPoint> {
    const body: Record<string, unknown> = {};
    if (patch.name !== undefined) body.name = patch.name;
    if (patch.address !== undefined) body.address = patch.address;
    if (patch.description !== undefined) body.description = patch.description;
    if (patch.cover_image !== undefined) body.cover_image_path = patch.cover_image;
    const p = await request<BackendPoint>(`/api/me/points/${id}`, { method: "PATCH", body });
    return adaptPoint(p);
  },

  async remove(id: string): Promise<void> {
    await request(`/api/me/points/${id}`, { method: "DELETE" });
  },
};

/* ============================================================
 * Flowers
 * ============================================================ */

export const flowers = {
  async list(point_id: string): Promise<Flower[]> {
    const list = await request<BackendFlower[]>(`/api/points/${point_id}/flowers`);
    return list.map(adaptFlower);
  },

  async listMine(point_id: string): Promise<Flower[]> {
    const list = await request<BackendFlower[]>(`/api/me/points/${point_id}/flowers`);
    return list.map(adaptFlower);
  },

  async create(
    point_id: string,
    input: {
      name: string;
      image: string;
      price_per_stem: number;
      quantity: number;
      color_tags: ColorTag[];
      description?: string;
    },
  ): Promise<Flower> {
    const f = await request<BackendFlower>(`/api/me/points/${point_id}/flowers`, {
      method: "POST",
      body: {
        name: input.name,
        image_path: input.image,
        price_per_stem: input.price_per_stem,
        quantity: input.quantity,
        color_tags: input.color_tags,
        description: input.description ?? null,
      },
    });
    return adaptFlower(f);
  },

  async update(
    point_id: string,
    id: string,
    patch: {
      name?: string;
      image?: string;
      price_per_stem?: number;
      quantity?: number;
      color_tags?: ColorTag[];
      description?: string | null;
    },
  ): Promise<Flower> {
    const body: Record<string, unknown> = {};
    if (patch.name !== undefined) body.name = patch.name;
    if (patch.image !== undefined) body.image_path = patch.image;
    if (patch.price_per_stem !== undefined) body.price_per_stem = patch.price_per_stem;
    if (patch.quantity !== undefined) body.quantity = patch.quantity;
    if (patch.color_tags !== undefined) body.color_tags = patch.color_tags;
    if (patch.description !== undefined) body.description = patch.description;
    const f = await request<BackendFlower>(`/api/me/points/${point_id}/flowers/${id}`, {
      method: "PATCH",
      body,
    });
    return adaptFlower(f);
  },

  async remove(point_id: string, id: string): Promise<void> {
    await request(`/api/me/points/${point_id}/flowers/${id}`, { method: "DELETE" });
  },
};

/* ============================================================
 * Portfolio
 * ============================================================ */

export const portfolio = {
  async list(point_id: string): Promise<PortfolioBouquet[]> {
    const list = await request<BackendPortfolioBouquet[]>(
      `/api/points/${point_id}/portfolio`,
    );
    return list.map(adaptBouquet);
  },

  async listMine(point_id: string): Promise<PortfolioBouquet[]> {
    const list = await request<BackendPortfolioBouquet[]>(
      `/api/me/points/${point_id}/portfolio`,
    );
    return list.map(adaptBouquet);
  },

  async create(
    point_id: string,
    input: {
      name: string;
      description: string;
      image: string;
      price: number;
      color_tags: ColorTag[];
      composition: { flower_id: string; quantity: number }[];
    },
  ): Promise<PortfolioBouquet> {
    const b = await request<BackendPortfolioBouquet>(
      `/api/me/points/${point_id}/portfolio`,
      {
        method: "POST",
        body: {
          name: input.name,
          description: input.description,
          image_path: input.image,
          price: input.price,
          color_tags: input.color_tags,
          composition: input.composition,
        },
      },
    );
    return adaptBouquet(b);
  },

  async remove(point_id: string, id: string): Promise<void> {
    await request(`/api/me/points/${point_id}/portfolio/${id}`, { method: "DELETE" });
  },
};

/* ============================================================
 * AI
 * ============================================================ */

export type ArrangementType = "handheld" | "vase" | "centerpiece";
export type GenerationMode = "ai" | "manual";

export interface AIGenerateInput {
  point_id: string;
  prompt: string;
  color_tags: ColorTag[];
  budget: number;
  arrangement_type?: ArrangementType | null;
  container_style?: string | null;
  mode?: GenerationMode;
  composition?: { flower_id: string; quantity: number }[] | null;
}

export const ai = {
  async generate(input: AIGenerateInput): Promise<AIGenerateAccepted> {
    return request<AIGenerateAccepted>("/api/ai/generate-bouquet", {
      method: "POST",
      body: input,
    });
  },

  async getStatus(generationId: string): Promise<AIGenerationStatusResponse> {
    const r = await request<{
      generation_id: string;
      status: "pending" | "ready" | "failed";
      variants: BackendAIVariant[];
      error_message: string | null;
    }>(`/api/me/ai-generations/${generationId}/status`);
    return {
      generation_id: r.generation_id,
      status: r.status,
      variants: r.variants.map(adaptAIVariant),
      error_message: r.error_message,
    };
  },

  async getGeneration(id: string): Promise<AIGeneration> {
    const g = await request<BackendAIGeneration>(`/api/me/ai-generations/${id}`);
    return adaptAIGeneration(g);
  },
};

/* ============================================================
 * Orders
 * ============================================================ */

export const orders = {
  async create(input: {
    point_id: string;
    source: "ai_generated" | "portfolio";
    ai_generation_id?: string;
    ai_variant_index?: number;
    portfolio_bouquet_id?: string;
    client_message?: string;
  }): Promise<Order> {
    const body: Record<string, unknown> = {
      point_id: input.point_id,
      source: input.source,
      ai_generation_id: input.ai_generation_id ?? null,
      ai_variant_index: input.ai_variant_index ?? null,
      portfolio_bouquet_id: input.portfolio_bouquet_id ?? null,
      client_message: input.client_message ?? null,
    };
    const o = await request<BackendOrder>("/api/orders", { method: "POST", body });
    return adaptOrder(o);
  },

  async listMine(filters?: { status?: OrderStatus | "all" }): Promise<Order[]> {
    const query: Record<string, string | undefined> = {};
    if (filters?.status && filters.status !== "all") query.status = filters.status;
    const list = await request<BackendOrder[]>("/api/me/orders", { query });
    return list.map(adaptOrder);
  },

  async get(id: string): Promise<Order> {
    const o = await request<BackendOrder>(`/api/orders/${id}`);
    return adaptOrder(o);
  },

  async accept(id: string): Promise<Order> {
    const o = await request<BackendOrder>(`/api/orders/${id}/accept`, { method: "POST" });
    return adaptOrder(o);
  },

  async decline(id: string, reason: string): Promise<Order> {
    const o = await request<BackendOrder>(`/api/orders/${id}/decline`, {
      method: "POST",
      body: { reason },
    });
    return adaptOrder(o);
  },

  async start(id: string): Promise<Order> {
    const o = await request<BackendOrder>(`/api/orders/${id}/start`, { method: "POST" });
    return adaptOrder(o);
  },

  async ready(id: string, photo: string): Promise<Order> {
    const o = await request<BackendOrder>(`/api/orders/${id}/ready`, {
      method: "POST",
      body: { result_image_path: photo },
    });
    return adaptOrder(o);
  },

  async complete(id: string): Promise<Order> {
    const o = await request<BackendOrder>(`/api/orders/${id}/complete`, { method: "POST" });
    return adaptOrder(o);
  },

  async rejectResult(id: string, reason: string): Promise<Order> {
    const o = await request<BackendOrder>(`/api/orders/${id}/reject-result`, {
      method: "POST",
      body: { reason },
    });
    return adaptOrder(o);
  },

  async cancelByConsumer(id: string): Promise<Order> {
    const o = await request<BackendOrder>(`/api/orders/${id}/cancel`, { method: "POST" });
    return adaptOrder(o);
  },

  async cancelByFlorist(id: string, reason: string): Promise<Order> {
    const o = await request<BackendOrder>(`/api/orders/${id}/cancel-by-florist`, {
      method: "POST",
      body: { reason },
    });
    return adaptOrder(o);
  },
};

/* ============================================================
 * Notifications
 * ============================================================ */

export const notifications = {
  async list(): Promise<AppNotification[]> {
    return request<AppNotification[]>("/api/notifications");
  },

  async unreadCount(): Promise<number> {
    const r = await request<{ unread: number }>("/api/notifications/unread-count");
    return r.unread;
  },

  async markRead(id: string): Promise<void> {
    await request(`/api/notifications/${id}/read`, { method: "POST" });
  },

  async markAllRead(): Promise<void> {
    await request("/api/notifications/read-all", { method: "POST" });
  },
};

/* ============================================================
 * Uploads
 * ============================================================ */

export const uploads = {
  async upload(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const r = await request<{ path: string }>("/api/uploads", {
      method: "POST",
      body: fd,
      isFormData: true,
    });
    return r.path;
  },
};

export const api = { auth, admin, points, flowers, portfolio, ai, orders, notifications, uploads };

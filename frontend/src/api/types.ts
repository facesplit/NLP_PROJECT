export type Role = "superadmin" | "floristadmin" | "consumer";

export type ColorTag =
  | "pink"
  | "white"
  | "red"
  | "yellow"
  | "blue"
  | "purple"
  | "orange"
  | "green"
  | "mixed";

export const COLOR_TAGS: ColorTag[] = [
  "pink",
  "white",
  "red",
  "yellow",
  "blue",
  "purple",
  "orange",
  "green",
  "mixed",
];

export const COLOR_LABELS: Record<ColorTag, string> = {
  pink: "Розовый",
  white: "Белый",
  red: "Красный",
  yellow: "Жёлтый",
  blue: "Голубой",
  purple: "Фиолетовый",
  orange: "Оранжевый",
  green: "Зелёный",
  mixed: "Микс",
};

export const COLOR_SWATCH: Record<ColorTag, string> = {
  pink: "#e8a5b5",
  white: "#f4ece2",
  red: "#c0392b",
  yellow: "#f0c64a",
  blue: "#7fa9c8",
  purple: "#9b7cb6",
  orange: "#e08e54",
  green: "#9bb08a",
  mixed: "linear-gradient(135deg,#e8a5b5,#f0c64a,#9bb08a,#9b7cb6)",
};

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
  display_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface FloristPoint {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  description: string | null;
  cover_image: string | null;
  rating: number;
  is_active: boolean;
  created_at: string;
}

export interface PointPublic extends FloristPoint {
  portfolio_count: number;
  flower_count: number;
}

export interface Flower {
  id: string;
  point_id: string;
  name: string;
  image: string;
  price_per_stem: number;
  quantity: number;
  color_tags: ColorTag[];
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PortfolioBouquet {
  id: string;
  point_id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  color_tags: ColorTag[];
  composition: { flower_id: string; quantity: number }[];
  is_active: boolean;
  created_at: string;
}

export type OrderSource = "ai_generated" | "portfolio";

export type OrderStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "in_progress"
  | "ready_for_pickup"
  | "completed"
  | "rejected_by_client"
  | "cancelled"
  | "cancelled_by_florist";

export interface CompositionItem {
  flower_id: string;
  name: string;
  price_per_stem: number;
  quantity: number;
}

export interface Order {
  id: string;
  consumer_id: string;
  point_id: string;
  source: OrderSource;
  status: OrderStatus;
  total_price: number;
  composition_snapshot: CompositionItem[];
  portfolio_bouquet_id: string | null;
  ai_generation_id: string | null;
  ai_variant_index: number | null;
  client_message: string | null;
  budget: number | null;
  result_image: string | null;
  decline_reason: string | null;
  rejection_reason: string | null;
  cancel_reason: string | null;
  accepted_at: string | null;
  in_progress_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export type AIVariantStatus = "pending" | "ready" | "failed";
export type AIGenerationStatus = "pending" | "ready" | "failed";

export interface AIVariant {
  index: number;
  status: AIVariantStatus;
  image: string | null;
  composition: (CompositionItem & { subtotal: number })[];
  total_price: number;
  explanation: string;
  error: string | null;
}

export interface AIGeneration {
  id: string;
  consumer_id: string;
  point_id: string;
  prompt: string;
  color_tags: ColorTag[];
  budget: number;
  variants: AIVariant[];
  status: AIGenerationStatus;
  error_message: string | null;
  created_at: string;
}

export interface AIGenerateAccepted {
  generation_id: string;
  status: AIGenerationStatus;
}

export interface AIGenerationStatusResponse {
  generation_id: string;
  status: AIGenerationStatus;
  variants: AIVariant[];
  error_message: string | null;
}

export type NotificationType =
  | "order_created"
  | "order_accepted"
  | "order_declined"
  | "order_in_progress"
  | "order_ready"
  | "order_completed"
  | "order_rejected_by_client"
  | "order_cancelled"
  | "order_cancelled_by_florist"
  | "role_changed";

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface AIConfig {
  id: number;
  system_prompt: string;
  negative_prompt: string;
  sampler_steps: number;
  sampler_cfg: number;
  sampler_name: string;
  image_width: number;
  image_height: number;
  budget_lower_pct: number;
  budget_upper_pct: number;
  llm_temperature: number;
  llm_max_retries: number;
  max_references: number;
  pipeline_version: "sd15" | "sdxl";
  updated_at: string;
  updated_by: string | null;
}

export type AIConfigPatch = Partial<
  Omit<AIConfig, "id" | "updated_at" | "updated_by">
>;

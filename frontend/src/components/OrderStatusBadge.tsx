import { useTranslation } from "react-i18next";
import { Badge } from "./ui/badge";
import type { OrderStatus } from "@/api/types";

const STATUS_VARIANT: Record<OrderStatus, "soft" | "default" | "secondary" | "outline" | "warn" | "success" | "destructive" | "sage"> = {
  pending: "soft",
  accepted: "sage",
  declined: "destructive",
  in_progress: "warn",
  ready_for_pickup: "default",
  completed: "success",
  rejected_by_client: "destructive",
  cancelled: "outline",
  cancelled_by_florist: "destructive",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation();
  return <Badge variant={STATUS_VARIANT[status]}>{t(`order_status.${status}`)}</Badge>;
}

export function useOrderStatusLabel(): (status: OrderStatus) => string {
  const { t } = useTranslation();
  return (status: OrderStatus) => t(`order_status.${status}`);
}

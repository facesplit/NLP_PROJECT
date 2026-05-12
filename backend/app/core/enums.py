from enum import StrEnum


class Role(StrEnum):
    SUPERADMIN = "superadmin"
    FLORISTADMIN = "floristadmin"
    CONSUMER = "consumer"


class OrderSource(StrEnum):
    AI_GENERATED = "ai_generated"
    PORTFOLIO = "portfolio"


class OrderStatus(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    IN_PROGRESS = "in_progress"
    READY_FOR_PICKUP = "ready_for_pickup"
    COMPLETED = "completed"
    REJECTED_BY_CLIENT = "rejected_by_client"
    CANCELLED = "cancelled"
    CANCELLED_BY_FLORIST = "cancelled_by_florist"


class NotificationType(StrEnum):
    ORDER_CREATED = "order_created"
    ORDER_ACCEPTED = "order_accepted"
    ORDER_DECLINED = "order_declined"
    ORDER_IN_PROGRESS = "order_in_progress"
    ORDER_READY = "order_ready"
    ORDER_COMPLETED = "order_completed"
    ORDER_REJECTED_BY_CLIENT = "order_rejected_by_client"
    ORDER_CANCELLED = "order_cancelled"
    ORDER_CANCELLED_BY_FLORIST = "order_cancelled_by_florist"
    ROLE_CHANGED = "role_changed"


class ColorTag(StrEnum):
    PINK = "pink"
    WHITE = "white"
    RED = "red"
    YELLOW = "yellow"
    BLUE = "blue"
    PURPLE = "purple"
    ORANGE = "orange"
    GREEN = "green"
    MIXED = "mixed"

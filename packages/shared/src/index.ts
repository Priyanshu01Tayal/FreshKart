export * from './types/database';

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PLACED: 'Order Placed',
  CONFIRMED: 'Order Confirmed',
  PACKED: 'Packed & Assigned',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export const COD_STATUS_LABELS: Record<string, string> = {
  PENDING_COLLECTION: 'Pending Collection',
  HELD_BY_PARTNER: 'Cash Collected (Held by Rider)',
  SETTLED_WITH_ADMIN: 'Settled with Store Register',
};

export const STORAGE_LIMITS = {
  PRODUCT_IMAGE_MAX_SIZE_BYTES: 2097152, // 2MB
  ALLOWED_IMAGE_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as const,
};


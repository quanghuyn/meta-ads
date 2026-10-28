// Chuẩn hoá một đơn Pancake POS thành bản ghi nội bộ. Không giữ SĐT, tên khách hay địa chỉ.
// Total Sale theo docs/decisions.md D1: total_price_after_sub_discount, các trạng thái được tính bên dưới.

export const INCLUDED_STATUSES = new Set([1, 2, 3, 8, 9, 11, 12, 13, 16, 17]);

export type RawOrder = {
  id?: unknown;
  inserted_at?: unknown;
  updated_at?: unknown;
  status?: unknown;
  ad_id?: unknown;
  conversation_id?: unknown;
  total_price_after_sub_discount?: unknown;
};

export type NormalizedOrder = {
  sourceId: string;
  conversationId: string | null;
  adId: string | null;
  createdAt: string; // ISO UTC
  updatedAt: string | null;
  status: string;
  amount: number;
  included: boolean;
  recognitionDate: string; // ngày VN (UTC+7), YYYY-MM-DD
};

export class SchemaChanged extends Error {
  readonly code = "SCHEMA_CHANGED";
}

const toUtcIso = (v: unknown): string | null => {
  if (typeof v !== "string" || v === "") return null;
  const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(v) ? v : `${v}Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export function normalizeOrder(raw: RawOrder): NormalizedOrder {
  if ((typeof raw.id !== "number" && typeof raw.id !== "string") || raw.id === "") throw new SchemaChanged("order.id");
  const created = toUtcIso(raw.inserted_at);
  if (!created) throw new SchemaChanged(`order.inserted_at (${raw.id})`);
  const amount = raw.total_price_after_sub_discount;
  if (typeof amount !== "number" || !Number.isFinite(amount)) throw new SchemaChanged(`order.total_price_after_sub_discount (${raw.id})`);
  const status = Number(raw.status);
  if (!Number.isInteger(status)) throw new SchemaChanged(`order.status (${raw.id})`);
  return {
    sourceId: String(raw.id),
    conversationId: typeof raw.conversation_id === "string" && raw.conversation_id !== "" ? raw.conversation_id : null,
    adId: typeof raw.ad_id === "string" && raw.ad_id !== "" ? raw.ad_id : null,
    createdAt: created,
    updatedAt: toUtcIso(raw.updated_at),
    status: String(status),
    amount,
    included: INCLUDED_STATUSES.has(status),
    recognitionDate: new Date(new Date(created).getTime() + 7 * 3600_000).toISOString().slice(0, 10),
  };
}

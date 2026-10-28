// Chuẩn hoá một hội thoại Pancake (đã xác minh ngày 28/10, xem docs/data-contracts.md) thành bản ghi nội bộ.
// Không lưu SĐT hay nội dung tin nhắn: chỉ cờ has_phone, nhãn và lần chạm quảng cáo.

export type RawConversation = {
  id?: unknown;
  inserted_at?: unknown;
  updated_at?: unknown;
  has_phone?: unknown;
  tags?: unknown;
  ads?: unknown;
  ad_ids?: unknown;
};

export type NormalizedConversation = {
  sourceId: string;
  sourceInsertedAt: string; // ISO UTC
  sourceUpdatedAt: string | null;
  hasPhone: boolean;
  tags: string[];
  touches: { sourceAdId: string; touchedAt: string | null; eventKey: string }[];
};

export class SchemaChanged extends Error {
  readonly code = "SCHEMA_CHANGED";
}

// Pancake trả ISO không kèm múi giờ và đó là UTC.
function toUtcIso(value: unknown): string | null {
  if (typeof value !== "string" || value === "") return null;
  const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function normalizeConversation(raw: RawConversation): NormalizedConversation {
  if (typeof raw.id !== "string" || raw.id === "") throw new SchemaChanged("conversation.id");
  const inserted = toUtcIso(raw.inserted_at);
  if (!inserted) throw new SchemaChanged(`conversation.inserted_at (${raw.id})`);

  const tags = Array.isArray(raw.tags)
    ? [...new Set(raw.tags.map((t) => (t && typeof t === "object" ? (t as { text?: unknown }).text : t))
        .filter((t): t is string => typeof t === "string" && t !== ""))]
    : [];

  // ads[] có giờ chạm; ad_ids[] chỉ dùng khi ads[] thiếu (touchedAt = null, không đủ để gán theo cửa sổ).
  const touches = new Map<string, { sourceAdId: string; touchedAt: string | null; eventKey: string }>();
  if (Array.isArray(raw.ads)) {
    for (const a of raw.ads as { ad_id?: unknown; inserted_at?: unknown }[]) {
      if (typeof a?.ad_id !== "string" || a.ad_id === "") continue;
      const at = toUtcIso(a.inserted_at);
      touches.set(a.ad_id, { sourceAdId: a.ad_id, touchedAt: at, eventKey: `${raw.id}:${a.ad_id}` });
    }
  }
  if (Array.isArray(raw.ad_ids)) {
    for (const id of raw.ad_ids) {
      if (typeof id === "string" && id !== "" && !touches.has(id)) {
        touches.set(id, { sourceAdId: id, touchedAt: null, eventKey: `${raw.id}:${id}` });
      }
    }
  }

  return {
    sourceId: raw.id,
    sourceInsertedAt: inserted,
    sourceUpdatedAt: toUtcIso(raw.updated_at),
    hasPhone: raw.has_phone === true,
    tags,
    touches: [...touches.values()],
  };
}

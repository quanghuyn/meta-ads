import { describe, expect, it } from "vitest";
import { normalizeOrder, SchemaChanged } from "../../supabase/functions/_shared/domain/pos-order";

describe("normalizeOrder", () => {
  it("ngày ghi nhận theo giờ VN, trạng thái 0 không tính", () => {
    const r = normalizeOrder({ id: 710867, inserted_at: "2026-10-27T17:30:00.5", status: 9, ad_id: "1", total_price_after_sub_discount: 3759999 });
    expect(r.recognitionDate).toBe("2026-10-28");
    expect(r.included).toBe(true);
    expect(r.sourceId).toBe("710867");
    expect(normalizeOrder({ id: 1, inserted_at: "2026-10-27T01:00:00", status: 0, total_price_after_sub_discount: 0 }).included).toBe(false);
  });
  it("thiếu số tiền thì SCHEMA_CHANGED", () => {
    expect(() => normalizeOrder({ id: 1, inserted_at: "2026-10-27T01:00:00", status: 2 })).toThrow(SchemaChanged);
  });
});

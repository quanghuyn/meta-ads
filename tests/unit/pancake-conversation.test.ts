import { describe, expect, it } from "vitest";
import { normalizeConversation, SchemaChanged } from "../../supabase/functions/_shared/domain/pancake-conversation";

describe("normalizeConversation", () => {
  it("coi inserted_at không múi giờ là UTC, bỏ nhãn null, gộp ad trùng", () => {
    const r = normalizeConversation({
      id: "p_1",
      inserted_at: "2026-10-27T17:05:00",
      has_phone: true,
      tags: [{ text: "XTS" }, { text: null }, { text: "XTS" }],
      ads: [{ ad_id: "111", inserted_at: "2026-10-27T17:06:00" }],
      ad_ids: ["111", "222"],
    });
    expect(r.sourceInsertedAt).toBe("2026-10-27T17:05:00.000Z");
    expect(r.tags).toEqual(["XTS"]);
    expect(r.touches).toEqual([
      { sourceAdId: "111", touchedAt: "2026-10-27T17:06:00.000Z", eventKey: "p_1:111" },
      { sourceAdId: "222", touchedAt: null, eventKey: "p_1:222" },
    ]);
    expect(r.hasPhone).toBe(true);
  });

  it("thiếu id hoặc inserted_at thì SCHEMA_CHANGED", () => {
    expect(() => normalizeConversation({ inserted_at: "2026-10-27T00:00:00" })).toThrow(SchemaChanged);
    expect(() => normalizeConversation({ id: "x" })).toThrow(SchemaChanged);
  });
});

import { describe, expect, it } from "vitest";
import { campaignDaily, unattributedDaily } from "../../src/app/bao-cao/campaign-daily-data";
import { dayRows } from "../../src/app/bao-cao/real-data";

describe("dữ liệu chiến dịch theo ngày khớp tổng theo ngày", () => {
  for (const d of dayRows) {
    it(d.date, () => {
      const rows = campaignDaily.filter((r) => r.date === d.date);
      const un = unattributedDaily.find((u) => u.date === d.date)!;
      expect(rows.filter((r) => r.account === "Nam Khoa 2").reduce((s, r) => s + r.spend, 0)).toBe(d.nk2.spend);
      expect(rows.filter((r) => r.account === "Nam Khoa 3").reduce((s, r) => s + r.spend, 0)).toBe(d.nk3.spend);
      expect(rows.reduce((s, r) => s + r.sale, 0) + un.unmapped.sale + un.noAd.sale).toBe(d.sale);
      expect(rows.reduce((s, r) => s + r.orders, 0) + un.unmapped.orders + un.noAd.orders).toBe(d.orders);
      expect(rows.reduce((s, r) => s + r.sale, 0) + un.unmapped.sale).toBe(d.saleAd);
    });
  }
});

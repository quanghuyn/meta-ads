// Ảnh chụp dữ liệu thật, lấy 28/10/2026 từ Meta (Nam Khoa 2, Nam Khoa 3) và Pancake POS shop 1546758.
// Chỉ số tổng hợp theo ngày, không có PII. Ngày theo giờ Việt Nam.
// sale = tổng total_price_after_sub_discount các đơn trạng thái 1,2,3,8,9,11,12,13,16,17 nguồn Facebook page 196059750263125 (theo inserted_at).
// inbox = tổng new_inbox_count theo giờ (hội thoại inbox mới, mọi nguồn, không chỉ từ quảng cáo); phones = tổng uniq_phone_number_count theo giờ
//   (Pancake statistics/pages, giờ VN; cộng theo giờ nên một SĐT có thể bị đếm lại ở giờ khác; hội thoại cũ có thể thu được SĐT trong ngày).
// saleAd/ordersAd = phần có ad_id (chưa xác minh ad_id thuộc tài khoản nào).
export type DayRow = {
  date: string;
  nk2: { spend: number; impressions: number; clicks: number };
  nk3: { spend: number; impressions: number; clicks: number };
  sale: number;
  orders: number;
  saleAd: number;
  ordersAd: number;
  inbox: number;
  phones: number;
};

export const asOf = "2026-10-28";

export const dayRows: DayRow[] = [
  { date: "2026-10-22", nk2: { spend: 25752345, impressions: 228057, clicks: 8836 }, nk3: { spend: 3301712, impressions: 22696, clicks: 831 }, sale: 71259984, orders: 21, saleAd: 60379987, ordersAd: 18, inbox: 213, phones: 104 },
  { date: "2026-10-23", nk2: { spend: 23179446, impressions: 228178, clicks: 9291 }, nk3: { spend: 2580719, impressions: 15901, clicks: 669 }, sale: 46859988, orders: 15, saleAd: 43579988, ordersAd: 14, inbox: 143, phones: 71 },
  { date: "2026-10-24", nk2: { spend: 22132306, impressions: 253108, clicks: 10440 }, nk3: { spend: 2388429, impressions: 21861, clicks: 951 }, sale: 36059990, orders: 12, saleAd: 32979990, ordersAd: 11, inbox: 122, phones: 54 },
  { date: "2026-10-25", nk2: { spend: 27907140, impressions: 292705, clicks: 10705 }, nk3: { spend: 3346573, impressions: 33179, clicks: 1168 }, sale: 30199994, orders: 9, saleAd: 26919994, ordersAd: 8, inbox: 142, phones: 68 },
  { date: "2026-10-26", nk2: { spend: 15588589, impressions: 117447, clicks: 4202 }, nk3: { spend: 10306609, impressions: 52826, clicks: 2204 }, sale: 41539990, orders: 13, saleAd: 41539990, ordersAd: 13, inbox: 99, phones: 47 },
  { date: "2026-10-27", nk2: { spend: 18973776, impressions: 169750, clicks: 6242 }, nk3: { spend: 12776137, impressions: 82204, clicks: 3251 }, sale: 50479985, orders: 16, saleAd: 33879990, ordersAd: 11, inbox: 112, phones: 55 },
  { date: "2026-10-28", nk2: { spend: 6906296, impressions: 59649, clicks: 2233 }, nk3: { spend: 6289568, impressions: 45963, clicks: 1809 }, sale: 41279992, orders: 13, saleAd: 34439993, ordersAd: 11, inbox: 57, phones: 35 },
];

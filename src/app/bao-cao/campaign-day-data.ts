// Đánh giá chiến dịch ngày 27/10/2026 (đủ 24 giờ, giờ VN). Ảnh chụp lúc 28/10, không PII.
// Hội thoại: Pancake page 196059750263125, tính theo quảng cáo chạm đầu tiên (ad_ids[0]) và nhãn hiện tại.
// qualified = có nhãn XTS/RLCD/XTS+RLCD và có SĐT (D2). trùng = nhãn "Trùng khách". koNhuCau = nhãn "Ko có nhu cầu".
// Các nhãn chồng nhau nên không cộng chéo được.
export type CampaignDay = {
  name: string; account: string; spend: number; impressions: number; clicks: number;
  orders: number; sale: number; mess: number; phones: number; qualified: number; dup: number; koNhuCau: number;
};
export const campaignDate = "2026-10-27";
export const campaignDayRows: CampaignDay[] = [
  { name: "25.9", account: "Nam Khoa 2", spend: 3089516, impressions: 14722, clicks: 534, orders: 1, sale: 3759999, mess: 9, phones: 5, qualified: 4, dup: 4, koNhuCau: 0 },
  { name: "cđ - cp - Bản sao 2", account: "Nam Khoa 2", spend: 2803141, impressions: 13815, clicks: 588, orders: 1, sale: 2659999, mess: 9, phones: 7, qualified: 3, dup: 2, koNhuCau: 1 },
  { name: "cđ - fbax -", account: "Nam Khoa 2", spend: 2082555, impressions: 40511, clicks: 1393, orders: 0, sale: 0, mess: 6, phones: 2, qualified: 2, dup: 0, koNhuCau: 0 },
  { name: "Trang that", account: "Nam Khoa 2", spend: 1905658, impressions: 9598, clicks: 410, orders: 1, sale: 3759999, mess: 5, phones: 4, qualified: 1, dup: 3, koNhuCau: 1 },
  { name: "26.10", account: "Nam Khoa 3", spend: 1841501, impressions: 10886, clicks: 701, orders: 2, sale: 5319998, mess: 4, phones: 2, qualified: 1, dup: 0, koNhuCau: 0 },
  { name: "26.10 - Bản sao", account: "Nam Khoa 3", spend: 1746288, impressions: 7055, clicks: 228, orders: 1, sale: 2180000, mess: 8, phones: 3, qualified: 3, dup: 2, koNhuCau: 0 },
  { name: "6.12", account: "Nam Khoa 2", spend: 1694335, impressions: 18841, clicks: 628, orders: 0, sale: 0, mess: 3, phones: 2, qualified: 1, dup: 0, koNhuCau: 1 },
  { name: "cđ - 2pp", account: "Nam Khoa 2", spend: 1554093, impressions: 11824, clicks: 410, orders: 0, sale: 0, mess: 7, phones: 3, qualified: 1, dup: 1, koNhuCau: 1 },
  { name: "26.10 - cp -", account: "Nam Khoa 3", spend: 1368375, impressions: 5547, clicks: 283, orders: 0, sale: 0, mess: 3, phones: 3, qualified: 2, dup: 1, koNhuCau: 0 },
  { name: "Feeback", account: "Nam Khoa 2", spend: 1362435, impressions: 20128, clicks: 602, orders: 0, sale: 0, mess: 8, phones: 1, qualified: 1, dup: 0, koNhuCau: 2 },
  { name: "17.10 - Bản sao", account: "Nam Khoa 2", spend: 1281259, impressions: 13782, clicks: 575, orders: 0, sale: 0, mess: 4, phones: 2, qualified: 1, dup: 1, koNhuCau: 1 },
  { name: "Test hv - Bản sao 2 - fb", account: "Nam Khoa 3", spend: 1127488, impressions: 11381, clicks: 368, orders: 1, sale: 2659999, mess: 3, phones: 3, qualified: 3, dup: 0, koNhuCau: 0 },
  { name: "cđ - pk", account: "Nam Khoa 2", spend: 1123704, impressions: 9611, clicks: 388, orders: 1, sale: 3559999, mess: 6, phones: 3, qualified: 2, dup: 3, koNhuCau: 1 },
  { name: "1lt", account: "Nam Khoa 3", spend: 1120053, impressions: 10740, clicks: 297, orders: 0, sale: 0, mess: 1, phones: 1, qualified: 1, dup: 0, koNhuCau: 0 },
  { name: "cđ - fbad", account: "Nam Khoa 2", spend: 1075931, impressions: 11780, clicks: 461, orders: 0, sale: 0, mess: 0, phones: 0, qualified: 0, dup: 0, koNhuCau: 0 },
  { name: "fb+test", account: "Nam Khoa 3", spend: 1013843, impressions: 12077, clicks: 410, orders: 0, sale: 0, mess: 0, phones: 0, qualified: 0, dup: 0, koNhuCau: 0 },
  { name: "Test 26.10", account: "Nam Khoa 3", spend: 1008730, impressions: 4827, clicks: 277, orders: 0, sale: 0, mess: 1, phones: 0, qualified: 0, dup: 0, koNhuCau: 1 },
  { name: "test", account: "Nam Khoa 2", spend: 1001091, impressions: 5136, clicks: 253, orders: 0, sale: 0, mess: 1, phones: 0, qualified: 0, dup: 0, koNhuCau: 0 },
  { name: "Test 26.10 - Bản sao", account: "Nam Khoa 3", spend: 981799, impressions: 6049, clicks: 239, orders: 1, sale: 3759999, mess: 2, phones: 1, qualified: 1, dup: 0, koNhuCau: 0 },
  { name: "Test hv", account: "Nam Khoa 3", spend: 922533, impressions: 3433, clicks: 88, orders: 0, sale: 0, mess: 2, phones: 1, qualified: 1, dup: 1, koNhuCau: 0 },
  { name: "27.10 - Bản sao", account: "Nam Khoa 3", spend: 613080, impressions: 4133, clicks: 141, orders: 0, sale: 0, mess: 0, phones: 0, qualified: 0, dup: 0, koNhuCau: 0 },
  { name: "27.10 (079)", account: "Nam Khoa 3", spend: 561576, impressions: 3879, clicks: 106, orders: 0, sale: 0, mess: 0, phones: 0, qualified: 0, dup: 0, koNhuCau: 0 },
  { name: "vnew tđ", account: "Nam Khoa 3", spend: 213668, impressions: 862, clicks: 52, orders: 0, sale: 0, mess: 2, phones: 1, qualified: 1, dup: 0, koNhuCau: 0 },
  { name: "vnew - Bản sao", account: "Nam Khoa 3", spend: 183725, impressions: 827, clicks: 51, orders: 0, sale: 0, mess: 3, phones: 0, qualified: 0, dup: 0, koNhuCau: 1 },
  { name: "IMG - Bản sao", account: "Nam Khoa 3", spend: 73478, impressions: 508, clicks: 10, orders: 0, sale: 0, mess: 0, phones: 0, qualified: 0, dup: 0, koNhuCau: 0 },
  { name: "fb dt", account: "Nam Khoa 2", spend: 0, impressions: 0, clicks: 0, orders: 0, sale: 0, mess: 2, phones: 2, qualified: 1, dup: 1, koNhuCau: 0 },
  { name: "19.10 - vnew", account: "Nam Khoa 2", spend: 0, impressions: 0, clicks: 0, orders: 1, sale: 3559999, mess: 1, phones: 1, qualified: 1, dup: 0, koNhuCau: 0 },
  { name: "CĐ - cp - MERA (806)", account: "Nam Khoa 2", spend: 0, impressions: 0, clicks: 0, orders: 0, sale: 0, mess: 1, phones: 0, qualified: 0, dup: 0, koNhuCau: 0 },
  { name: "14.10 - mera group - Bản sao", account: "Nam Khoa 2", spend: 0, impressions: 0, clicks: 0, orders: 0, sale: 0, mess: 1, phones: 0, qualified: 0, dup: 0, koNhuCau: 0 },
  { name: "CĐ - cp - MERA -", account: "Nam Khoa 2", spend: 0, impressions: 0, clicks: 0, orders: 0, sale: 0, mess: 2, phones: 1, qualified: 0, dup: 0, koNhuCau: 0 },
];
// Hội thoại không gán được chiến dịch (không tự phân bổ).
export const campaignDayOther = [
  { label: "Không có quảng cáo", mess: 10, phones: 0, qualified: 0, dup: 3, koNhuCau: 0 },
  { label: "Quảng cáo ngoài Nam Khoa 2/3", mess: 7, phones: 3, qualified: 1, dup: 1, koNhuCau: 0 },
  { label: "Quảng cáo 120254056465140387 (chưa xác nhận chiến dịch)", mess: 1, phones: 1, qualified: 1, dup: 0, koNhuCau: 0 },
];
export const campaignDayOrdersOther = { unmapped: { orders: 1, sale: 2659999 }, noAd: { orders: 5, sale: 16599995 } };

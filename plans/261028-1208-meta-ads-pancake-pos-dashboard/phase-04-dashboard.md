---
phase: 4
title: "Dashboard"
status: pending
effort: "4–6 ngày"
dependencies: [3]
---

# Giai đoạn 4: Dashboard

## Bối cảnh và yêu cầu

Bố cục theo ảnh tham chiếu; dữ liệu thật từ 2 ad account, 1 page, 1 shop. Revenue dùng Total Sale đúng báo cáo POS, có basis hiển thị. Không sao số mẫu: 907 all clicks, 18.511 impressions và CTR 2,65% không khớp cùng một định nghĩa; phải tính lại từ nguồn và ghi rõ all/link.

## Tệp đề xuất

`src/app/(dashboard)/overview/page.tsx`, `ads/page.tsx`, `conversations/page.tsx`, `orders/page.tsx`, `settings/page.tsx`; `src/components/dashboard/`; `src/lib/metrics/queries.ts`, `definitions.ts` và bộ lọc/cache theo tenant/quyền/settings version.

## Các bước

1. Shell responsive/sidebar; lọc kỳ, so kỳ trước, account/page/shop/campaign/adset/ad. Hiển thị timezone, currency, revenue basis và kiểu ngày.
2. Sáu thẻ CIR, internal ROAS, revenue kèm orders, spend, CPA paid, close rate cohort. Tooltip có công thức/phạm vi; MER và Meta-reported ROAS hiển thị riêng nếu có.
3. Threshold CIR từng adset có default và ngày hiệu lực. Nhiều adset khác mục tiêu hiển thị theo hàng, không giả một mục tiêu chung; headroom không gọi profit.
4. Chart ngày spend/revenue trục tiền, ROAS trục riêng; tooltip/legend, so kỳ trước, gap không dữ liệu và mục tiêu có ý nghĩa với scope.
5. Funnel impressions → link clicks → eligible dedup conversations → qualified → converted conversations/orders. Impressions/clicks là events, không giả định là cùng tập người theo dõi xuyên suốt. Chỉ tính tỷ lệ khi có mẫu số/cohort hợp lệ; orders tách khỏi converted conversations.
6. Bảng đóng góp campaign/adset/ad giữ Organic/Unattributed, revenue/spend/CIR/ROAS/orders/coverage; so CTR all/link, CPM, AOV từ cùng tập order/revenue.
7. Drilldown KPI/chart tới chi tiết có lý do matching; export giữ filter/metric labels và PII theo role.
8. Settings versioned rules nhu cầu + có SĐT (không điều kiện khu vực), window, Total Sale source basis và CIR theo quyền; nêu tái tính lịch sử hay chỉ tương lai trước lưu. Tags chỉ evidence/mirror. Drilldown xem predicate/evidence/version/evaluated_at và pending/manual override có audit.
9. Trạng thái nguồn gồm last success, source freshness, local sync time, stale/error, coverage và retry cho admin; phân biệt loading/empty/N/A/error.

## Kiểm thử và hoàn tất

- [ ] KPI/chart/table khớp query/export cùng filter; đổi account/page không lẫn cache/tenant.
- [ ] Drilldown và đóng góp khớp tổng; mẫu số 0 là N/A, không Infinity/0 giả.
- [ ] Close rate đúng qualified cohort/window; cohort chưa đủ thời gian có nhãn.
- [ ] Mobile, keyboard/focus/contrast dùng được; có bảng dữ liệu thay cho chart.
- [ ] Empty/stale/error/missing attribution và nhiều CIR thresholds hiển thị đúng; không dùng fake data làm fallback.

## Rủi ro và quay lui

Funnel có thể gây hiểu lầm khi ghép events với người dùng; ghi định nghĩa/giới hạn và không tạo tỷ lệ thiếu mẫu số hợp lệ. Query/chart sai: rollback deployment hoặc ẩn KPI lỗi kèm thông báo, không thay bằng số mẫu.

---
title: "Meta Ads Pancake POS dashboard"
description: "Dashboard nội bộ Meta Ads × Pancake Inbox × Pancake POS"
status: pending
priority: P1
effort: "17–25 ngày kỹ thuật sau khi có quyền API"
tags: []
created: 2026-10-28
updated: 2026-10-28
---

# Dashboard nội bộ Meta Ads × Pancake × POS

Đây là kế hoạch, chưa triển khai app hoặc tạo tài nguyên bên ngoài. Chưa có repo mã nguồn để xác nhận đường dẫn triển khai. Stack đề xuất: Next.js/TypeScript, Tailwind/shadcn/ui, Recharts; GitHub private, Vercel, Supabase theo lựa chọn người dùng. Supabase Auth/Postgres/RLS, Cron và worker Edge Functions xử lý đồng bộ theo batch ngắn; không chạy backfill dài trong request Next.js.

## Giai đoạn

| Giai đoạn | Dự kiến | Phụ thuộc | Trạng thái |
|---|---:|---|---|
| [1. Kiểm chứng dữ liệu và định nghĩa](./phase-01-start.md) | 2–3 ngày | Quyền API và quyết định nghiệp vụ | Chưa bắt đầu |
| [2. Nền tảng và bảo mật](./phase-02-foundation.md) | 2–3 ngày | 1 | Chưa bắt đầu |
| [3. Đồng bộ dữ liệu và rule qualification](./phase-03-data-sync.md) | 7–10 ngày | 2 và hợp đồng dữ liệu đã kiểm chứng | Chưa bắt đầu |
| [4. Dashboard](./phase-04-dashboard.md) | 4–6 ngày | 3 | Chưa bắt đầu |
| [5. Nghiệm thu và phát hành](./phase-05-validation-release.md) | 2–3 ngày | 4 | Chưa bắt đầu |

Phạm vi người dùng đã chốt: 2 ad account, 1 page, 1 shop; revenue là Total Sale; qualified theo rules nhu cầu + có SĐT (không điều kiện khu vực). Tổng 17–25 ngày kỹ thuật, chưa gồm chờ quyền, duyệt nền tảng hoặc chốt chi tiết rule. Total Sale phải khớp đúng báo cáo POS nguồn; không tự thay bằng tiền thu hoặc doanh thu giao thành công. MER dùng tổng shop Total Sale/spend; internal ROAS dùng Total Sale đã nối được theo quảng cáo/spend.

## Tiêu chí hoàn tất

- [ ] Sáu KPI, biểu đồ chi phí/doanh thu/ROAS, funnel và bảng so sánh dùng dữ liệu thật; mobile và drilldown dùng được.
- [ ] Counts/sums khớp chính xác export cùng kỳ, tài khoản, múi giờ, tiền tệ và filter. Chênh Meta attribution được giải thích riêng, không che bằng tolerance chung.
- [ ] Hiển thị coverage, Organic và Unattributed; không phân bổ doanh thu theo spend hay suy diễn tên adset.
- [ ] Replay idempotent; nhận sửa đơn hủy/hoàn kể cả đơn cũ; hiển thị lỗi, độ mới và trạng thái từng nguồn.
- [ ] RLS và tenant check ở worker đạt; không lộ API secrets trong client/Git/log; preview tách DB và webhook production.
- [ ] Vai trò admin/marketing/sales, versioned qualification rules, ngưỡng CIR và Total Sale basis được nghiệm thu.

## Các giả định cần người dùng xác nhận

1. Đã chốt (docs/decisions.md): nhu cầu XTS/RLCD, có SĐT, không khu vực. Còn chờ: ánh xạ thẻ sale sang mức chất lượng sau SĐT, xử lý "Trùng khách", cách xử lý evidence mâu thuẫn.
2. Lịch sử cần lấy, currency, business timezone (Nam Khoa 3 chưa kiểm). Người dùng: team marketing.
3. Total Sale đã chốt (docs/decisions.md D1): tổng total_price_after_sub_discount theo ngày tạo đơn, các trạng thái 1,2,3,8,9,11,12,13,16,17; cần kiểm đơn prepaid, đơn hoàn/hủy sau ngày tạo và ý nghĩa mã 6, 11.
4. Threshold CIR từng adset, paid-touch rule và conversion window đề xuất 7 ngày.

MVP chưa gồm AI tự qualify, CAPI, tự chỉnh ngân sách hay CRM đầy đủ. Không hứa phục hồi referral/qualification lịch sử nếu nguồn không lưu.

## Bộ đặc tả giao Claude Code

Người dùng yêu cầu chi tiết đủ để Claude Code viết code. Các phase ở trên giữ vai trò lộ trình; các đặc tả dưới đây là hợp đồng chi tiết khi triển khai. Chuẩn hóa tên scope trong code là workspace_id; tenant/organization trong phase cũ là cùng khái niệm, không tạo thêm mô hình song song.

1. [Product brief, kiến trúc và cấu trúc repo](./specs/01-product-architecture.md)
2. [Schema database, migrations và quyền](./specs/02-database-security.md)
3. [Hợp đồng nguồn, adapters và đồng bộ](./specs/03-source-sync-contracts.md)
4. [Qualification, attribution và công thức](./specs/04-business-rules-metrics.md)
5. [API nội bộ, giao diện và states](./specs/05-web-api-ui.md)
6. [Test matrix, CI và phát hành](./specs/06-testing-release.md)
7. [Checklist công việc và dependencies](./implementation-checklist.md)
8. [Prompt bắt đầu/tiếp tục cho Claude Code](./handoff/START-HERE.md)

Metadata/schema/API trong specs là thiết kế nội bộ. Các endpoint/field nhà cung cấp chưa có bằng chứng vẫn phải xác minh ở bước thử dữ liệu. Ưu tiên quyết định người dùng, rồi specs chi tiết, rồi phase mô tả; nếu mâu thuẫn ảnh hưởng contract thì sửa đồng bộ docs trước khi code.

Markdown là nguồn theo dõi; chưa đăng ký vào planstore CLI. Báo cáo triển khai sau này đặt trong reports/. Không cần AgentKit hoặc plugin đặc biệt để triển khai bộ tài liệu này.

# Bộ giao việc Claude Code — Dashboard Meta Ads / Pancake / POS

Ngày: 28/10/2026. Bộ này gồm tài liệu triển khai và ảnh tham chiếu, chưa có mã ứng dụng.

## Cách sử dụng

1. Giải nén vào thư mục dự án bạn sẽ mở bằng Claude Code. Nếu repo đang có code, giữ nguyên code và hợp nhất CLAUDE.md; không ghi đè hướng dẫn cũ.
2. Mở START-HERE.md ở gốc, copy prompt triển khai vào Claude Code.
3. Claude đọc plan/specs, khảo sát repo và thực hiện checklist. Không cần cài các skill AgentKit của người lập kế hoạch.
4. Cấp credentials qua môi trường/secret store khi tới bước tích hợp; các mục nghiệp vụ đã chốt nằm ở docs/decisions.md; chỉ còn cần xác nhận ánh xạ thẻ sale khi cần kích hoạt quy tắc.

## Thành phần trong gói

| File/thư mục | Nội dung |
|---|---|
| START-HERE.md | Prompt bắt đầu và tiếp tục phiên sau |
| CLAUDE.md | Quy tắc thực thi và các quyết định không được tự đổi |
| assets/dashboard-reference.png | Ảnh dashboard do người dùng cung cấp |
| plans/261028-1208-meta-ads-pancake-pos-dashboard/plan.md | Mục lục, lộ trình 5 giai đoạn |
| plans/.../implementation-checklist.md | Các task, phụ thuộc và bằng chứng hoàn tất |
| plans/.../specs/01-product-architecture.md | Product brief, stack, folder structure, roles |
| plans/.../specs/02-database-security.md | Schema/constraints/indexes/migrations/RLS |
| plans/.../specs/03-source-sync-contracts.md | Adapters, jobs, retry, webhook, secrets |
| plans/.../specs/04-business-rules-metrics.md | Qualification, attribution, cohort và KPI |
| plans/.../specs/05-web-api-ui.md | API contract, filters, DTO, UI states |
| plans/.../specs/06-testing-release.md | Test cases, đối soát, CI, deploy/rollback |
| plans/.../phase-*.md | Mục tiêu, rủi ro và tiêu chí của từng giai đoạn |

## Phạm vi đã chốt

2 tài khoản Ads, 1 page, 1 shop; Total Sale đúng báo cáo POS; qualified theo nhu cầu + có SĐT (không điều kiện khu vực); web GitHub/Vercel/Supabase. Thiết kế nội bộ lấy Next.js/TypeScript/Tailwind/shadcn/Recharts và Supabase Postgres/Auth/Cron/Edge Functions.

Các lựa chọn còn draft: ánh xạ thẻ sale sang mức chất lượng, xử lý "Trùng khách", cửa sổ attribution (xem docs/decisions.md). Đây là thông tin cần cấu hình/xác minh, không ngăn Claude xây phần nền tảng độc lập.

## Tiêu chí thành công

Claude tạo code hoạt động, test có kết quả thực tế, source mapping có bằng chứng, dashboard không hiển thị dữ liệu giả khi nguồn thiếu. Dữ liệu chưa ghép phải hiển thị lý do; tiền/đơn/hội thoại không đếm trùng. Ước lượng trước đây 17–25 ngày công chỉ là dự toán kỹ thuật, không phải cam kết thời gian chạy của Claude Code.

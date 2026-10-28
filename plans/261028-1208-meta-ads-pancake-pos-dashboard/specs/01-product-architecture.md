# Product brief và kiến trúc để triển khai

Ngày: 2026-10-28. Tài liệu này đặc tả thiết kế nội bộ đề xuất; không phải tài liệu xác nhận payload của các nhà cung cấp.

## Quyết định đã chốt

- Web nội bộ tiếng Việt, 2 tài khoản Meta Ads, 1 fanpage Pancake, 1 shop Pancake POS.
- GitHub quản lý code; Vercel chạy web; Supabase quản lý database/Auth/jobs.
- Doanh thu là Total Sale theo đúng báo cáo POS người dùng đang dùng.
- Qualified mess xét bằng nhu cầu (XTS/RLCD) và có SĐT, không điều kiện khu vực; thẻ sale đánh giá chất lượng sau SĐT (docs/decisions.md). Không dùng AI trong MVP.
- Thiết kế theo `assets/dashboard-reference.png`; giữ bố cục 6 thẻ và 4 khối chart, sửa các nhãn/công thức không đúng.
- Hiện tại là yêu cầu viết kế hoạch. Claude chỉ triển khai khi người dùng đưa prompt triển khai vào repo.

## Quyết định kỹ thuật mặc định

Next.js App Router, TypeScript strict, Tailwind CSS, shadcn/ui, Recharts, Supabase Auth/Postgres, Zod, Vitest, Playwright; npm và một package-lock.json. Chọn bản stable tương thích khi scaffold và ghi version đã chọn; không đoán số version mới nhất. Không thêm ORM, Redis, microservices hoặc framework agent cho MVP.

Một repo, một workspace nghiệp vụ. Vẫn có workspace_id để kiểm soát phạm vi dữ liệu; không xây UI SaaS billing, tự tạo workspace hay onboarding đa doanh nghiệp. Auth theo lời mời, email/password, đăng ký công khai tắt. Admin đầu tiên được bootstrap bằng thao tác có kiểm soát; không tự gán admin cho người đăng ký đầu tiên.

Node chạy web trên Vercel; Deno chạy worker trên Supabase Edge Functions. Domain logic thuần TypeScript ở `supabase/functions/_shared/domain/`, không import Node/Next/browser API, không dùng network. Next và Vitest import từ đó bằng cấu hình phù hợp; Deno dùng relative imports. Đây là một nguồn duy nhất cho phép tính và quyết định qualification/attribution. SQL truy vấn tổng hợp phải có tests đối chiếu cùng định nghĩa.

## Luồng dữ liệu

1. Cron enqueue job cho từng connection; webhook tạo sự kiện bền vững.
2. Worker đọc một batch API thật, validate shape, chuẩn hóa theo source-contracts.
3. Transaction ghi entities + checkpoint; enqueue đánh giá lại lead/đơn bị ảnh hưởng.
4. Rule engine phân loại; attribution nối đơn với hội thoại và paid touch có chứng cứ.
5. Reporting SQL tổng hợp độc lập spend/orders/conversations, sau đó mới join theo chiều báo cáo.
6. Next API kiểm tra session và quyền, trả DTO đã loại dữ liệu vượt quyền; giao diện hiển thị số liệu và freshness.

Worker chỉ chạy batch có giới hạn. Supabase Cron và Edge Functions có giới hạn khác nhau; không coi giới hạn Cron là thời gian CPU cho phép của Edge Function. Khi thực thi phải kiểm tra [Edge Function limits](https://supabase.com/docs/guides/functions/limits). Mục tiêu thiết kế mỗi lượt xử lý dưới 30 giây wall clock và lượng tính toán nhỏ; tiếp tục bằng job sau, điều chỉnh theo benchmark và quota thực tế.

## Cấu trúc repo dự kiến

```text
CLAUDE.md
README.md
assets/dashboard-reference.png
docs/
  source-access.md
  data-contracts.md
  metric-definitions.md
  decisions.md
  operations-runbook.md
plans/261028-1208-meta-ads-pancake-pos-dashboard/
src/
  app/
    (auth)/login/page.tsx
    (dashboard)/layout.tsx
    (dashboard)/overview/page.tsx
    (dashboard)/ads/page.tsx
    (dashboard)/conversations/page.tsx
    (dashboard)/orders/page.tsx
    (dashboard)/settings/page.tsx
    (dashboard)/sync/page.tsx
    api/...
  components/{ui,dashboard,filters,tables}/
  lib/{auth,supabase,reporting,validation}/
supabase/
  config.toml
  migrations/
  functions/
    _shared/{domain,adapters,db,security}/
    run-sync-jobs/index.ts
    webhook-inbox/index.ts
    webhook-pos/index.ts
tests/{unit,integration,e2e,fixtures}/
scripts/
.github/workflows/ci.yml
.env.example
```

Tên file mới kebab-case; convention framework như page.tsx/route.ts giữ nguyên. Các đường dẫn này dự kiến cho repo mới; nếu repo đã tồn tại thì khảo sát và thích nghi trước khi tạo.

## Vai trò

MVP chỉ dùng admin và marketing (quyết định 28/10/2026). Cột sales giữ trong bảng để mở sau, không xây màn hình sales.

| Hành động | Admin | Marketing | Sales |
|---|---|---|---|
| Xem dashboard/bảng Ads/CSV tổng hợp | Có | Có | Không mặc định |
| Xem hội thoại/đơn được phân công | Tất cả trong workspace | Chỉ metadata đã che PII | Chỉ được phân công |
| Đọc bằng chứng chứa thông tin khách | Có | Không mặc định | Chỉ được phân công |
| Ghi nhận bổ sung/override qualification | Có | Không | Chỉ được phân công; bắt buộc lý do |
| Sửa cấu hình, mời user, retry/backfill | Có | Không | Không |
| Đọc token API trên giao diện | Không | Không | Không |

Thông tin phân công đến từ mapping nhân viên nguồn đã kiểm chứng hoặc admin phân công. Chưa map thì sales chưa được xem, không mở toàn bộ dữ liệu để tiện phát triển. Quyền thực thi tại DB/RPC và server, không chỉ ẩn nút.

## Phần có thể làm khi chưa có credentials

Scaffold, migrations, Auth, UI shell/empty states, domain logic, validation, unit/DB tests và tài liệu cấu hình. Các API chưa có dữ liệu trả trạng thái not_configured hoặc unavailable đúng ngữ nghĩa. Không tạo dữ liệu giả trong dashboard và không đánh dấu tích hợp hoàn tất. Dữ liệu kiểm thử tổng hợp chỉ ở tests, không xuất hiện qua đường production.

## Ngoài MVP

AI phân loại, CAPI, chỉnh ngân sách/quảng cáo, gửi tin nhắn khách, sửa đơn POS, CRM đầy đủ, live realtime socket, đa tiền tệ có tỷ giá, SaaS nhiều doanh nghiệp. Bản đầu dùng UI refresh có kiểm soát, không cần websocket.

## Quyết định nghiệp vụ chưa đủ chi tiết

Đã chốt nhu cầu XTS/RLCD, có SĐT, không khu vực, Total Sale và CIR 45% (docs/decisions.md). Còn chờ: ánh xạ thẻ sale, "Trùng khách"; timezone/currency từng ad account (Nam Khoa 3 chưa kiểm); lịch sử cần nhập; cửa sổ attribution. Chuẩn bị form cấu hình cho những mục này. Giá trị đề xuất 7 ngày, CIR 45%, Ads 30 phút, Inbox/POS 10 phút phải gắn draft/unconfirmed; chỉ phần tính toán phụ thuộc cấu hình đó chờ xác nhận, các phần độc lập tiếp tục làm.

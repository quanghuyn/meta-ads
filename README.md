# Dashboard Meta Ads × Pancake × POS

Dashboard nội bộ cho team marketing: chi tiêu Meta Ads, chất lượng hội thoại Pancake và doanh thu Pancake POS trên cùng một nơi. Chỉ đọc dữ liệu, không gửi tin, không sửa đơn, không đổi quảng cáo.

## Các trang

| Đường dẫn | Nội dung |
|---|---|
| `/bao-cao` | Tổng quan Ads × Doanh thu: chi tiêu, Total Sale, CIR, ROAS theo ngày và theo chiến dịch |
| `/chat-luong-mess` | Chất lượng mess Pancake theo ngày và theo chiến dịch: SĐT, qualified, nhãn sale |
| `/dang-nhap` | Đăng nhập Supabase Auth; cần membership admin hoặc marketing |

## Kiến trúc

- Web: Next.js (App Router), TypeScript, Tailwind, Recharts, triển khai trên Vercel.
- Dữ liệu: Supabase Postgres với RLS; web chỉ đọc qua các RPC tổng hợp, không dùng service-role key.
- Meta: nhận qua webhook (`supabase/functions/meta-ads-webhook`), chuẩn hoá bằng trigger trong DB.
- Pancake và POS: worker `supabase/functions/sync` chạy theo lịch pg_cron.
- `supabase/functions/sync-meta` đang tắt lịch, giữ lại để bật lại khi cần (xem `docs/webhook-reporting.md`).

Khai báo nguồn của web (ID tài khoản, page, shop) nằm ở `src/lib/sources.ts`; ngưỡng CIR ở `src/lib/format.ts`. Worker Deno và các hàm SQL có bản khai báo riêng.

## Chạy local

```bash
npm install
cp .env.example .env.local   # điền URL và anon key của Supabase
npm run dev
```

Production dùng cặp biến `REPORT_SUPABASE_URL` và `REPORT_SUPABASE_PUBLISHABLE_KEY`; chi tiết ở `docs/deployment.md`.

## Kiểm tra

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

`npm test` chạy unit test và test migration/RLS trên PGlite. Edge Function chạy trên Deno, cần kiểm riêng bằng `deno check`. `npm run format` định dạng code bằng Prettier.

## Tài liệu

- `docs/decisions.md`: quyết định nghiệp vụ của chủ dự án, ưu tiên cao nhất khi có mâu thuẫn.
- `docs/data-contracts.md`: các trường nguồn đã kiểm chứng.
- `docs/webhook-reporting.md`, `docs/pancake-quality.md`, `docs/report-ui-data.md`: hợp đồng từng phần.
- `docs/deployment.md`: triển khai và rollback.
- `plans/`, `reports/`, `START-HERE.md`: bộ kế hoạch và prompt giao việc ban đầu, giữ làm hồ sơ.

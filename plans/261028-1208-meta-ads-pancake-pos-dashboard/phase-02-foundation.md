---
phase: 2
title: "Nền tảng và bảo mật"
status: pending
effort: "2–3 ngày"
dependencies: [1]
---

# Giai đoạn 2: Nền tảng

## Bối cảnh và yêu cầu

Dựa trên hợp đồng giai đoạn 1. GitHub private, Vercel, Supabase đã được chọn; tên tài nguyên/region cần chốt trong lần triển khai, không tạo tại bước lập kế hoạch. Next.js/TypeScript, Tailwind/shadcn và Recharts phải pin phiên bản tương thích sau kiểm tra docs hiện hành.

Mỗi bảng nghiệp vụ có `organization_id`; Supabase Auth theo lời mời nội bộ, RLS cô lập tenant. Admin quản lý connection/settings, marketing đọc phân tích, sales đọc nghiệp vụ được cấp; chốt ma trận PII. Service role chỉ server và kiểm tra tenant/account/page/shop từng job vì có thể bỏ qua RLS.

## Tệp đề xuất

Tạo `src/app/`, `src/components/`, `src/lib/supabase/`, `src/lib/auth/`, `supabase/migrations/`, CI workflow, `.env.example` chỉ placeholder và `docs/deployment.md`. Không có tệp cần xóa.

## Các bước

1. Khi được triển khai, thiết lập repo private, dev/preview/prod, CI lint/typecheck/build trên PR.
2. Làm app shell, login/session server, invite/logout và role checks.
3. Tạo organizations, memberships, connection metadata, versioned qualification rule/predicate settings và audit trail quyền/settings/manual overrides. Scope đã chốt 2 ad account, 1 page, 1 shop; Total Sale theo báo cáo POS nguồn.
4. RLS từng bảng; API/server actions không tin tenant ID client tự gửi.
5. API tokens/service secrets trong server secret store; log metadata, không token/payload PII; retention theo hợp đồng.
6. Preview dùng Supabase project/credentials riêng, không có lịch hoặc webhook production; thử migration/restore ở staging.

## Kiểm thử và hoàn tất

- [ ] Lint/typecheck/build đạt; auth và role hoạt động trên preview.
- [ ] User tenant A không đọc/ghi tenant B qua client/API; worker từ chối job sai scope.
- [ ] Marketing/sales không đổi connection secrets/settings/quyền; bundle/Git/log không có secret.
- [ ] Preview không cập nhật DB/webhook production.

## Rủi ro và quay lui

Sai RLS/env gây lộ dữ liệu: chặn phát hành đến khi test đạt, rotate credentials nếu lộ. Migration thêm mới, thử staging; rollback app về deployment trước, không xóa bảng để chữa UI.

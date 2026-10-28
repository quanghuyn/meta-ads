---
phase: 3
title: "Đồng bộ dữ liệu"
status: pending
effort: "7–10 ngày"
dependencies: [2]
---

# Giai đoạn 3: Đồng bộ và mô hình dữ liệu

## Bối cảnh và yêu cầu

[Supabase Cron](https://supabase.com/docs/guides/cron) tạo durable jobs; Edge Functions xử lý batch ngắn trong giới hạn runtime hiện hành, không backfill dài trong Next.js request. Đề xuất Ads refresh 30 phút; Inbox/POS webhook nếu đã xác minh và polling đối soát 5–15 phút. Đây là mục tiêu đo sau thử tải; độ trễ nhà cung cấp hiển thị riêng.

Pull lại Ads 7 ngày gần nhất mỗi đêm; mở rộng khi thực tế nguồn có điều chỉnh lâu hơn. Đối soát trạng thái đơn cũ còn mở và hoàn/hủy, không giới hạn mọi cập nhật vào đơn mới.

## Tệp và mô hình đề xuất

- `supabase/migrations/`: connections, ad_accounts/campaigns/adsets/ads, ad_daily_stats, conversations, conversation_events, qualification_rules/versions/predicate_results/events, audited_overrides, orders/order_lines, order_conversation_links, attribution_links, sync_jobs/watermarks/runs. Phạm vi 2 ad account, 1 page, 1 shop.
- Khóa gồm tenant + source scope + source ID. Ads daily unique tenant/account/ad/date và mọi dimension thực sự lấy. Tiền dùng decimal/đơn vị nhỏ nhất cùng currency, không float.
- `supabase/functions/sync-meta/`, `sync-inbox/`, `sync-pos/`, `webhook-inbox/`, `webhook-pos/`; thư viện adapter dùng chung và `src/lib/metrics/`. Raw tối thiểu có retention/access control, không vào Git.

## Các bước

1. Viết adapter theo payload thật, source timestamp và ingested timestamp; lưu raw cần thiết, chuẩn hóa và aggregates riêng.
2. Meta lấy ad/day không creative breakdown để tránh nhân spend. Lưu all clicks/link clicks riêng và action type riêng; kiểm tra dimension/timezone.
3. Inbox upsert conversations/referral và evidence từ structured fields/customer/phone/geo; lấy giới hạn message content khi cần. Rule engine versioned xét nhu cầu + có SĐT (không điều kiện khu vực); AND need_match và phone_present (đã chốt, không có predicate khu vực); thẻ sale là tầng chất lượng sau SĐT. Lưu từng predicate evidence/source/version/evidence_at/evaluated_at, qualified/unqualified/pending và audited override có nguồn. Evidence lần đầu chỉ xuất hiện trong đơn POS sau mua không được dùng để ghi ngược lead đã qualified trước mua; giữ riêng thời điểm evidence và thời điểm đánh giá. Text mơ hồ/phủ định để pending, không AI; chỉ cần có SĐT, không kiểm định dạng. Thẻ XTS/RLCD là evidence nhu cầu; các thẻ còn lại là tầng chất lượng. Snapshot đầu tiên không dựng ngược lịch sử.
4. POS upsert orders/status/discount/ship/return để khớp chính xác Total Sale của báo cáo nguồn về status và ngày. Không tự thay thành delivered revenue/cash collected hoặc tự loại đơn hủy. Nhận thay đổi cũ và full/partial return theo API/contract, không nhân đơn.
5. Webhook xác thực theo nguồn, lưu bền vững rồi phản hồi; dedup/replay/out-of-order. Nếu nguồn thiếu cơ chế xác thực đủ an toàn, dùng polling xác thực và chỉ coi webhook là tín hiệu đọc lại API.
6. Chạy matching rõ ràng trước, fallback scoped customer/unique phone theo quy tắc được duyệt; ambiguity chờ rà soát. Mỗi order tối đa một paid attribution hợp lệ; lưu bằng chứng/lý do/version rule.
7. Giữ Organic/Unattributed/ambiguous riêng, coverage attribution và qualification. Cấu hình version bảo đảm có thể giải thích hoặc tái tính lịch sử.
8. Jobs có lease, retry backoff/jitter theo quota, dead-letter và manual replay. Watermark chỉ tiến sau commit; backfill chia kỳ nhỏ, có progress/checkpoint.
9. Aggregate/RPC riêng cho ngày vận hành và cohort, cùng filter numerator/denominator; hiển thị freshness/token/quota/error từng connection.

## Kiểm thử và hoàn tất

- [ ] Counts/spend/revenue khớp export cùng kỳ/filter/currency/timezone, gồm biên ngày và ngày rỗng.
- [ ] Batch/webhook replay không nhân đôi; crash/resume và worker đồng thời không sai watermark.
- [ ] Sự kiện trễ/đảo thứ tự không ghi đè mới; đơn cũ hủy/hoàn được sửa.
- [ ] Không duplicate spend do breakdown/join; tổng child bằng parent khi giữ Unattributed.
- [ ] Không ghép customer khác page/shop; nhiều touch chỉ một attribution/order; thiếu khóa/organic/ambiguous đúng kỳ vọng.
- [ ] Truth table và regression rule khớp mẫu 30–50 được rà soát thủ công, gồm thiếu field, phủ định, không có SĐT, thẻ nhu cầu mâu thuẫn, evidence mâu thuẫn và manual override. Rule chưa đủ cấu hình không tự qualified.
- [ ] Meta-reported ROAS khác internal ROAS có giải thích, không tolerance chung che lỗi.

## Rủi ro và quay lui

API/quota/token lỗi: dừng riêng connection, giữ dữ liệu cuối và nhãn stale. Aggregate lỗi: rebuild từ raw và rule version. Attribution lỗi: ngừng KPI bị ảnh hưởng, giữ shop totals và bằng chứng để sửa/replay; không xóa raw che lỗi.

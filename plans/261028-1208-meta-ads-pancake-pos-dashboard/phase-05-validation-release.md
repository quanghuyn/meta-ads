---
phase: 5
title: "Nghiệm thu và phát hành"
status: pending
effort: "2–3 ngày"
dependencies: [4]
---

# Giai đoạn 5: Nghiệm thu và phát hành

## Bối cảnh và yêu cầu

Chỉ phát hành nội bộ sau acceptance giai đoạn 1–4. Nối webhook production sau staging đối soát và với quyền triển khai phù hợp; UI hoàn tất không đồng nghĩa dữ liệu đúng.

## Tệp đề xuất

`tests/metrics/`, `tests/sync/`, `tests/security/`, `tests/e2e/`, CI workflow; `docs/deployment.md`, `docs/data-quality.md`, `docs/operations-runbook.md`; báo cáo trong thư mục kế hoạch `reports/`. Đọc docs hiện có trước khi cập nhật, không tự thêm changelog nếu repo không yêu cầu.

## Các bước

1. Test hẹp metric/upsert/retry/matching, rồi DB integration/RLS, lint/typecheck/build và E2E cần thiết.
2. Export thật cùng ngày/timezone/currency/filter/status: đối chiếu counts/sums trước, ratios sau; ghi từng chênh và nguyên nhân. Meta ROAS khác internal cần so attribution rule, không ép bằng nhau.
3. Với 2 ad account, 1 page, 1 shop, test biên kỳ, đơn cũ hủy/hoàn theo Total Sale report basis, nhiều đơn/conversation, referral thiếu, rule version/thiếu evidence/phủ định/vùng chưa rõ/manual override; token hết hạn, quota, timeout, webhook trùng/mất và polling phục hồi. Regression rule đối chiếu truth table và 30–50 mẫu rà soát thủ công.
4. Đo query trên quy mô thật; thêm index/aggregate khi có bằng chứng. Đo vendor lag riêng pipeline lag, ghi baseline refresh sau kiểm thử.
5. Test hai tenant, quyền worker/server, secrets scan, PII log/export và preview/prod. Review cross-module/data/security contract trước phát hành.
6. Admin/marketing nghiệm thu desktop/mobile, metric definitions, rules nhu cầu + có SĐT (không điều kiện khu vực), Total Sale đúng báo cáo nguồn, CIR và coverage; ghi các giới hạn được chấp nhận. Không kích hoạt tầng chất lượng khi ánh xạ thẻ sale chưa được xác nhận.
7. Migration production đã thử staging, deploy Vercel, bật jobs từng nguồn, nối webhook đúng môi trường; đối soát batch đầu trước sử dụng thường xuyên.
8. Bàn giao runbook: token rotation, replay, đối soát, thêm account/page/shop, settings, retention, backup/restore và cảnh báo.

## Tiêu chí hoàn tất

- [ ] CI commit phát hành đạt, không còn test/build/lint/type lỗi hoặc chênh chưa giải thích.
- [ ] Acceptance `plan.md` và bảng đối soát có bằng chứng; người nghiệm thu xác nhận định nghĩa.
- [ ] Theo dõi refresh và đợt đối soát đêm đầu; lỗi nghiêm trọng có người xử lý.
- [ ] Diễn tập job recovery/app rollback ở staging; runbook ghi giới hạn lịch sử/attribution.

## Rủi ro và quay lui

Data lệch: dừng connection/aggregate bị lỗi, đánh dấu stale, giữ raw/audit để replay. Rollback Vercel về deployment trước. DB ưu tiên forward fix tương thích; chỉ restore backup sau đánh giá dữ liệu phát sinh, không mặc định xóa dữ liệu. Preview không đổi DB/webhook production.

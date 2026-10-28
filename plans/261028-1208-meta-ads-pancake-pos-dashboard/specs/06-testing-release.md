# Kiểm thử, nghiệm thu và phát hành

## Các lệnh repo phải cung cấp

Claude thiết lập scripts phù hợp tool versions đã chọn:

```text
npm ci
npm run dev
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
npm run check
```

check tổng hợp lint/typecheck/unit/build; integration/E2E cần môi trường local Supabase và được gọi riêng trong CI phù hợp. Cần thêm Deno check/tests cho Edge Functions; không tuyên bố worker đã typecheck chỉ vì Next build pass. Ghi yêu cầu Node/Deno/Docker/Supabase CLI trong README; pin phiên bản tool dùng được, không bắt người dùng tự đoán.

## Test matrix tối thiểu

| Nhóm | Tình huống | Kỳ vọng |
|---|---|---|
| Metric | spend100, sale500; nhóm thứ hai spend300, sale600 | ROAS tổng1100/400=2,75, không trung bình5 và2 |
| Join | Một conversation có 2 orders, nhiều touches, nhiều messages | Đơn2, converted conversation1, spend không đổi |
| Null/zero | Source lỗi; query thành công0 records; denominator0 | Ba trạng thái khác nhau, không cùng trả0 |
| Qualification | 3 pass; một fail; unknown; conflict; inactive rule | qualified; unqualified; pending; pending; pending theo precedence |
| Evidence | Phone từ bot/nhân viên, số trong mã đơn; địa danh mơ hồ; phủ định | Không pass sai; reason có thể kiểm tra |
| Temporal | Evidence xuất hiện sau mua; đổi rule; override | Không backdate; kết quả version cũ còn truy được |
| Qualified cutoff | qualified→mua→unqualified trước cutoff | Loại khỏi cả qualified denominator và numerator; overall conversion vẫn theo policy |
| Lead origin | Một conversation có touch thuộc nhiều adsets | Chỉ một active conversation attribution; tổng qualified không nhân theo touch |
| Historical cutoff | Query kỳ cũ sau khi đơn bị hoàn mới cập nhật | Report restated, meta không tự nhận historical knowledge snapshot |
| Attribution | Nhiều touch, ngoài7ngày, sau đơn, timestamp thiếu, tie hai ad | Chọn last hợp lệ; ngoài/sau/thiếu không paid; tie ambiguous |
| Identity | Customer ID giống nhau nhưng page/shop khác; phone trùng | Không ghép chéo hoặc đoán một ứng viên |
| Total Sale | Discount/ship/status/full-partial return/deletion | Khớp source contract đã kiểm chứng; không double return |
| Counts | Một order có nhiều adjustment facts | Order count1, amount tổng đúng |
| Time | Ngày cuối kỳ, qua nửa đêm, hai account timezone khác, immature cohort | Boundaries [start,nextDay); không gộp sai ngày |
| Incompatible scope | Hai account khác currency/timezone trong combined ratio | 422 rõ nguyên nhân; không tự đổi ngày/tiền |
| Sync | Webhook2lần; job crash trước/sau commit; old worker sau lease | Idempotent; checkpoint đúng; fencing chặn commit cũ |
| Updates | Đơn cũ hoàn; event đảo thứ tự; pagination bị lỗi giữa chừng | Cập nhật đúng; không ghi đè mới; báo partial và retry |
| Security | Anonymous, sai role/workspace, private evidence, service worker sai scope | 401/403/404 đúng; không lộ data/PII/secrets |
| UI/API | Filter URL, charts↔tables↔export, empty/stale, mobile | Cùng số/cùng scope; trạng thái rõ; không overflow toàn trang |

Số ở test matrix là fixture để chứng minh phép tính, chỉ dùng trong tests. Không sử dụng làm fallback production hoặc bằng chứng đã nối API. Contract tests dùng payload nguồn đã khử PII có nguồn gốc; live tests dùng credentials môi trường kiểm thử, read-only và không chạy mặc định trong mọi PR.

## Đối soát dữ liệu thật

Lấy cùng kỳ 7–14 ngày, ngày giờ export, account/shop filters, timezone, currency, attribution/query profile và Total Sale source report. So raw counts/sums trước, ratios sau; ghi bảng expected/actual/difference/explanation. Sai số chỉ từ rounding đã mô tả; không dùng ngưỡng lệch1–5% để cho qua data bug.

30–50 hội thoại/order mẫu được người phụ trách chấm; có paid, organic, unknown, ambiguous, qualified/unqualified/pending, nhiều đơn và hủy/hoàn. Đây là pilot validation, không chứng minh độ chính xác tuyệt đối trên toàn bộ lịch sử. Báo cáo coverage và loại lỗi; fix sai lệch có nguyên nhân trước phát hành.

## GitHub/CI

Repo private; .env và payload khách không commit. Branch task ngắn, commit conventional, PR ghi vấn đề/thay đổi/validation. GitHub Actions chạy check trên PR; database integration dùng Supabase local hoặc project test riêng. PR từ ngữ cảnh không tin cậy không được cấp production secrets. Không chạy cron nghiệp vụ bằng GitHub Actions đồng thời với Supabase Cron.

Không có lỗi lint/type/build thì mới merge theo quyền đã được người dùng cấp. Không bỏ qua tests hoặc đổi assertions để giấu sai. Code review tập trung attribution, RLS, worker concurrency và Total Sale mapping.

## Release sequence

1. Xác nhận staging config, source access và data contract. Chạy CI, đối soát và test quyền.
2. Backup, thử restore staging, kiểm tra migrations backward-compatible; không reset production.
3. Cấu hình secrets production trực tiếp trên dịch vụ, kiểm tra không xuất hiện trong bundle/log.
4. Deploy Next lên Vercel, migrations/functions lên Supabase theo quyền triển khai được người dùng cấp.
5. Bật connector từng nguồn, batch nhỏ; kiểm tra kết quả trước backfill lớn.
6. Cài webhook production sau khi endpoint và xác thực đã kiểm tra; không làm thay đổi tích hợp Pancake khác nếu chưa hiểu tác động.
7. Bật Cron một lần, kiểm tra không duplicate schedules, theo dõi đợt reconciliation đầu.
8. Bàn giao README + operations-runbook + known-limitations + báo cáo nghiệm thu.

## Quan sát và phục hồi

Log structured chỉ metadata an toàn: request/job/connection IDs, elapsed, rows read/written/rejected, cursor progress, error code. Hiện freshness từng nguồn, failed jobs, token lỗi, coverage thay đổi. Ngưỡng cảnh báo đề xuất stale khi >2 chu kỳ và khoảng dung sai đã đo; không báo stale chỉ vì nguồn không có đơn mới nếu sync thành công.

Job lỗi: pause connection cần thiết, sửa credentials/adapter, replay từ checkpoint. Domain logic sai: giữ raw/evidence, tạo version sửa và recompute vùng ảnh hưởng. UI lỗi: rollback Vercel. DB ưu tiên forward fix tương thích; restore chỉ sau đánh giá dữ liệu phát sinh. Có tài liệu chủ sở hữu từng tài khoản và người xử lý lỗi.

## Definition of Done

- Code chạy local và staging, actual source connection được kiểm chứng hoặc báo rõ phần còn blocked.
- Dashboard dùng dữ liệu thật, có drilldown/evidence, version và freshness; không demo data fallback.
- Total Sale khớp báo cáo POS; ad attribution/qualification có lý do và không nhân bản totals.
- Mọi check bắt buộc có kết quả; không gọi task complete khi credentials hoặc data mapping còn chặn nghiệm thu nguồn đó.
- Tài liệu setup/recovery/limitations và báo cáo tests cập nhật; deploy chỉ khi trong phạm vi được người dùng cho phép.

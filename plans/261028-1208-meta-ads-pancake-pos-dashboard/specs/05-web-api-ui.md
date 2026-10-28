# API ứng dụng và giao diện

Các endpoint dưới đây là API nội bộ của ứng dụng đề xuất, không phải URL của Meta/Pancake.

## Request/response chung

GET report filters: from/to dạng YYYY-MM-DD (inclusive trong timezone tương thích đã chọn); basis operational/cohort; accountIds/campaignIds/adsetIds/adIds; ruleVersion; settingsVersion; asOf. Với dữ liệu event timestamp server chuyển ngày thành [startUTC, nextDayUTC); với ad daily fact phải filter source_date nguyên bản, không đổi nhãn timezone. Kiểm tra mọi ID thuộc workspace. Không nhận arbitrary SQL/sort column. Khoảng ngày mặc định7ngày, tối đa đề xuất90ngày mỗi query; admin export/backfill dài chạy job riêng.

Combined account report chỉ được chạy khi currency và reporting timezone tương thích. Nếu hai account khác currency/timezone hoặc POS recognition day không thể đối chiếu cùng basis, trả422 INCOMPATIBLE_REPORT_SCOPE cho combined ROAS/MER/CIR, chỉ dẫn tách scope và vẫn cho xem báo cáo từng nguồn. Không tự đổi tiền hoặc giả chia daily spend theo giờ. Đa timezone có resampling/đa currency không thuộc MVP; cần data contract mới nếu người dùng yêu cầu.

Mọi response báo cáo trả data + meta: workspace, normalizedFilters, currency, timezone, dateBasis, settingsVersion, ruleVersion, asOf, restatedAt, historicalKnowledgeSnapshot=false, sourceFreshness từng nguồn, warnings, coverage. asOf là cutoff nghiệp vụ theo specs04, không time-travel source snapshot. Metric DTO: value number hoặc decimal string cho money, unit, numerator/denominator khi cần, status ready/partial/stale/unavailable/not_applicable, reasonCode. Status not_configured ở connection không biến thành zero metric.

Lỗi JSON: code, message tiếng Việt an toàn, requestId, fieldErrors optional. HTTP: 400 input sai; 401 chưa login; 403 không quyền; 404 đối tượng ngoài scope/không tồn tại; 409 version hoặc job conflict; 422 cấu hình không đủ; 429 rate limit; 502/503 lỗi nguồn khi thao tác live. Không trả stack/token/vendor URL chứa secret.

## Endpoints

| Endpoint | Quyền | Trả về/hành vi |
|---|---|---|
| GET /api/reports/overview | admin/marketing | 6 KPI + quality metrics + meta; lấy một snapshot logic nhất quán |
| GET /api/reports/trends | admin/marketing | Daily points spend/sale/ROAS; missing point tách zero |
| GET /api/reports/ad-performance | admin/marketing | groupBy campaign/adset/ad, cursor, sort allowlist; totals riêng |
| GET /api/reports/funnel | admin/marketing | volume stages + denominator definition; không tạo tỷ lệ người từ all clicks |
| GET /api/reports/revenue-composition | admin/marketing | Paid groups + organic/other/unattributed ở shop scope |
| GET /api/conversations | các role theo scope | Cursor list, qualification/status filters, metadata đã che PII theo quyền |
| GET /api/conversations/:id | các role theo scope | Evidence phù hợp quyền, kết quả predicates, liên kết đơn/touch |
| POST /api/conversations/:id/review | admin/sales được phân công | Bổ sung review/override kèm reason, expectedVersion; append audit/result, không sửa nguồn |
| GET /api/orders và /api/orders/:id | các role theo scope | Total Sale facts, attribution, reason, trạng thái nguồn |
| GET /api/settings | admin | Connection metadata và settings, không secret values |
| POST /api/settings/rules/drafts | admin | Tạo draft version, schema validation |
| POST /api/settings/rules/:id/activate | admin | Yêu cầu đủ cấu hình/xác nhận, transaction active version; không tự reprocess lịch sử |
| POST /api/settings/reporting/drafts và /:id/activate | admin | Version Total Sale contract, attribution/window/CIR; activation validation |
| POST /api/sync/jobs | admin | Validate connection/range; enqueue, HTTP202 jobId; Idempotency-Key |
| GET /api/sync/jobs và /:id | admin | Progress/errors safe; không payload có PII |
| POST /api/sync/jobs/:id/retry | admin | Chỉ failed/retry hợp lệ, không tạo worker overlap |
| GET /api/exports/ad-performance.csv | admin/marketing | Cùng filter/snapshot, giới hạn rows, CSV injection-safe |

HTTP writes với session cookie phải kiểm tra origin/CSRF theo cơ chế framework đã chọn. Idempotency-Key scoped workspace+action; optimistic concurrency dùng version thay vì last-write-wins settings. Review expectedVersion là conversations.revision; lock conversation và compare/increment cùng transaction append review/result/audit, sai revision trả409. Export escape đúng CSV và vô hiệu spreadsheet formula ở text bắt đầu =,+,-,@; numeric columns có schema riêng, không làm hỏng số âm hợp lệ.

## Scope và filters trên giao diện

Ở scope shop: thẻ Total Sale là toàn shop và MER có nhãn riêng. Khi chọn campaign/adset/ad: thẻ doanh thu đổi nhãn “Total Sale phân bổ Ads”, chỉ gồm đơn ghép được; không còn hiển thị shop MER như thể thuộc nhóm đã chọn. Bucket organic/unattributed vẫn xem ở trang đối soát shop, không tự gán chúng vào campaign được lọc.

Ẩn/disable filter không áp dụng thay vì bỏ qua âm thầm. Mọi tooltip KPI nêu tử số/mẫu số, nguồn, ngày và version. URL query lưu filter để share nội bộ; không đưa PII/secret vào URL. Cache riêng theo user role/workspace/filter/version; không public cache response có session.

## Layout theo screenshot

- Desktop: hàng đầu 6 KPI, dưới là grid 2 cột. Khối trái trên CIR từng adset; phải trên spend/sale bars và ROAS line; trái dưới funnel; phải dưới contribution donut và CTR/CPM/AOV.
- Ở viewport hẹp: KPI 2 cột rồi 1 cột tùy chiều rộng; charts stack; bảng scroll ngang trong container, không làm toàn trang tràn.
- Nền sáng, thẻ border nhẹ, khoảng cách rõ; green cho đạt mục tiêu, orange cảnh báo, red vượt ngưỡng. Màu không là tín hiệu duy nhất.
- Dùng format vi-VN và VND nếu nguồn xác nhận; số tiền đầy đủ trong tooltip, nhãn compact trên chart. Không render chart revenue cùng ROAS trên một trục.
- Mỗi chart có bảng số liệu hoặc nội dung đọc được; hỗ trợ keyboard/focus, label/form errors. Không cần animation phức tạp.
- KPI click → bảng đã lọc; conversation detail hiển thị từng điều kiện và source timestamp; order detail giải thích nguồn Ads hay lý do chưa ghép.

## Trạng thái UI bắt buộc

loading skeleton; not_configured hướng dẫn admin; empty sau query thành công không có bản ghi; partial có số nguồn thành công/thất bại; stale giữ dữ liệu trước cùng mốc cập nhật; error có requestId và retry hợp quyền; not_applicable cho mẫu số không hợp lệ.

Không hiện “0 doanh thu” khi POS token lỗi. Không render 50,88% close rate từ 29 orders/57 conversations nếu chưa tính unique converted conversations. Không hiện 907 clicks đi kèm CTR2,65% trên 18.511 impressions như một bộ cùng định nghĩa.

## Query implementation

Reporting functions nên nhận filters có type và gọi SQL parameterized. Aggregate mỗi bảng fact trước rồi join dimensions; count distinct conversation/order đúng chỗ. Một order nhiều sale adjustments và một conversation nhiều messages/touches không được nhân spend. Filter date dùng cùng contract; views/RPC không được bypass RLS ngoài ý muốn. Chỉ materialize/cache sau khi correctness tests đạt.

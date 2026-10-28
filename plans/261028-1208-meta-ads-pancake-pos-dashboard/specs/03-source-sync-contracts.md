# Hợp đồng nguồn và đồng bộ

## Nguyên tắc bắt buộc

API đã tồn tại không có nghĩa mọi field cần dùng đều tồn tại hoặc tài khoản được cấp quyền. Endpoint/field chưa xác minh phải ghi `unverified` trong docs/data-contracts.md; không tự tạo URL hoặc đoán mã trạng thái. Connector production phải là HTTP API chính thức; không phụ thuộc MCP của phiên chat hoặc cookie trình duyệt.

## Hợp đồng adapter nội bộ

Mỗi adapter trả `records`, `nextCursor`, `sourceWindow`, `observedAt`, `warnings` và metadata version. Cursor opaque, không suy ra page_number nếu nguồn dùng pagination khác. Lỗi chuẩn hóa: `AUTH_EXPIRED`, `PERMISSION_DENIED`, `RATE_LIMITED`, `SOURCE_UNAVAILABLE`, `SCHEMA_CHANGED`, `INVALID_CURSOR`. Field optional thiếu là null. MVP khi field bắt buộc thiếu: đánh dấu SCHEMA_CHANGED, giữ checkpoint của batch trước, không commit batch hoặc advance cursor; lưu lỗi an toàn có source reference để sửa adapter rồi replay. Báo cáo overall có thể partial vì batch trước đã thành công, nhưng batch lỗi không bị bỏ qua. Không cần thêm quarantine service trong MVP.

| Adapter | Operations cần có | Dữ liệu bắt buộc kiểm chứng |
|---|---|---|
| Meta | validateConnection, fetchAdEntities, fetchDailyInsights | ID account/campaign/adset/ad; source date/currency/timezone; spend/impressions/all clicks; link clicks/actions optional |
| Inbox | validateConnection, fetchConversations, fetchConversationEvidence, fetchTags nếu hữu ích | page+conversation ID, customer namespace, first inbound thực, nguồn message/customer fields, referral/ad ID/timestamp nếu có |
| POS | validateConnection, fetchOrders, fetchOrderDetail khi cần | shop+order ID, created/updated dates, amount components, statuses, khách/link hội thoại, deleted/returns coverage |

Trong docs/data-contracts.md ghi bảng source path → internal field → type/nullability → timezone/unit → payload bằng chứng đã khử PII → ngày kiểm tra. Record thật có bí mật/PII giữ ngoài Git.

## Meta

Khảo sát Insights đọc-only tại [Meta Insights](https://developers.facebook.com/docs/marketing-api/insights/) và [SDK chính thức](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adsinsights.py). Kiểm tra quyền ads_read, asset grants và access tier trên app thực tế; không xin ads_management cho thao tác chưa cần.

Grain dự kiến ad/day; không breakdown ở MVP. query_profile_hash bao gồm fields/dimensions/attribution và cấu hình thời gian có ảnh hưởng kết quả. Chỉ một query profile active được cộng vào báo cáo; không cộng hai snapshot của cùng ad/day. Số liệu trả lại sau sync là replacement/upsert, không cộng dồn spend.

Hai ad account về cùng page không được cộng trùng cùng conversation. Ad identity gồm account/connection; metadata phải xác định đúng account sở hữu ad_id. Account khác timezone/currency thì phân nhóm, không tự cộng hoặc đổi ngày. Nếu cần timezone thống nhất mà daily source không đủ thì đề xuất source granularity phù hợp trước khi thay contract.

Đề xuất Ads 30 phút; refresh recent 7 ngày mỗi đêm và backfill thủ công có giới hạn. Missing ad/day chỉ được hiểu là zero khi query hoàn tất và source contract xác nhận nghĩa đó; batch lỗi không xóa snapshot cũ.

## Pancake Inbox

Tài liệu: [Pancake API](https://developer.pancake.biz/), [Tools/API/Webhook](https://docs.pancake.biz/pancake/st-f7/st-p6?lang=en).

Kiểm chứng bộ lọc thời gian nghĩa là created/updated/last activity, không gán tùy ý. Dữ liệu thiếu first_inbound_at không được thay bằng last_updated. Có thể dùng ngày first_observed cho báo cáo riêng có nhãn; không đưa vào historical cohort như đã biết ngày thật.

Evidence ưu tiên structured customer/conversation fields. Đọc message metadata/nội dung giới hạn khi cần xác minh nhu cầu/referral/phone/region; không tải toàn bộ lịch sử mỗi chu kỳ. Lưu cả evidence_at và observed_at; nếu chỉ có snapshot hiện tại thì evidence_at không biết và kết luận lịch sử phải giữ chất lượng snapshot.

Thẻ sale là bằng chứng nhu cầu (XTS/RLCD) và là tầng chất lượng sau SĐT theo docs/decisions.md; không thay định nghĩa qualified. Page-scoped IDs không tự join với customer ID POS. API không có referral thì ad-level attribution vẫn unavailable cho ca đó; không dùng khoảng giờ hoặc tên campaign để đoán.

## Pancake POS

Tài liệu: [POS Open API](https://docs.pancake.biz/pos/st-f13/st-p1?lang=en). Bước đầu phải so report Total Sale và export thực tế với field amount/status/date. Không dùng aggs.cod hoặc total_price làm Total Sale trước khi chứng minh.

Nếu báo cáo chỉ có tổng mà không truy được amount ở từng đơn, lưu shop_sale_snapshots cho kỳ/filter/contract chính xác để hiển thị Total Sale toàn shop với source_basis rõ. Adapter có operation fetchShopSaleReport khi đã kiểm chứng endpoint report; nếu không có endpoint thì không dựng operation giả. Không cộng snapshot chồng lấn hoặc cộng cùng order facts. Ad-level revenue bị giới hạn; không chia tổng theo số đơn/spend để tạo attribution giả.

Poll theo updated_at khi endpoint hỗ trợ. Nếu không hỗ trợ thì dùng cơ chế quét được chứng minh không bỏ sót: recent window + tập đơn mở/đang hoàn + đối soát full range định kỳ phù hợp quota. Document giới hạn coverage đối với đơn cũ đóng rồi hoàn; cần nguồn webhook/change feed hoặc full reconciliation để đảm bảo. Không tuyên bố hoàn tất nếu đường cập nhật đơn cũ chưa được kiểm chứng.

## Job orchestration

Cron SQL chỉ enqueue công việc đến hạn và kích hoạt worker qua đường được xác thực. Job types: meta_entities, meta_daily, inbox_delta, pos_delta, reconcile_range, qualify_conversation, attribute_order. Các task domain gộp theo batch nhỏ; không tạo job riêng cho mọi field.

State machine: queued → running → succeeded; lỗi tạm → retry → running; lỗi quyền/schema hoặc quá số lần → failed. Đề xuất retry tối đa 5 lần, backoff có jitter và tôn trọng Retry-After; giá trị cấu hình vận hành, không đổi contract nghiệp vụ.

Claim atomically bằng transaction/row lock SKIP LOCKED hoặc RPC tương đương. Mỗi claim tăng fencing_token; batch commit chỉ hợp lệ nếu lease/token còn là owner. Transaction commit upsert + checkpoint + enqueue downstream đồng thời. Không giữ DB transaction mở trong lúc gọi vendor HTTP.

Worker chết sau HTTP nhưng trước commit: đọc lại batch an toàn. Worker cũ thức lại sau lease hết: fencing token từ chối commit. Backfill và incremental cùng connection/stream phải lock hoặc dùng watermark độc lập để backfill không kéo lùi incremental checkpoint.

Các entity update cũ hơn source_updated_at không ghi đè mới. Nếu nguồn không có thứ tự đáng tin cậy, fetch authoritative current state hoặc serialize connection và reconciliation, không dựa vào arrival order webhook.

## Webhook

Endpoint Supabase functions/webhook-inbox và webhook-pos được nhà cung cấp gọi; không yêu cầu user session, nhưng phải xác thực nguồn theo tài liệu thực. Nếu không có chữ ký tin cậy, dùng payload như tín hiệu có rate limit để đọc lại từ API; tuyệt đối không nhận amount/status trực tiếp làm sự thật.

Lưu event có dedupe key và acknowledgment sau khi lưu thành công; xử lý async. Không đặt secret trong query string nếu có header/signature phù hợp. Event key ưu tiên ID nguồn; nếu không có dùng hash canonical của sự kiện và timestamp/source identity đã kiểm chứng, không hash riêng message text.

## Môi trường và secrets

| Biến/nhóm | Nơi dùng | Ghi chú |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Web | Public project URL |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Web | Key public theo SDK hiện hành, không phải service role |
| SUPABASE server privileged credential | Worker/server khi thật sự cần | Chọn secret/service-role phù hợp SDK; tuyệt đối không NEXT_PUBLIC |
| META_API_VERSION | Worker | Pin sau khi validate docs/account |
| META token cho từng connection | Worker secret store | Tên secret map allowlist, không arbitrary env read từ DB |
| PANCAKE page token, POS API key | Worker secret store | Không log request URL khi token đi query theo vendor |
| WORKER_TRIGGER_SECRET | Cron/worker | Internal authentication, không dùng như user auth |
| Vendor webhook secret nếu hỗ trợ | Webhook function | Theo cơ chế đã kiểm chứng |
| APP_BASE_URL, environment marker | Web | Redirect URL riêng preview/production |

.env.example chỉ chứa tên biến và placeholder trống; dùng .gitignore loại .env thật. Cấu hình Meta/Pancake token chỉ ở worker nếu web không cần gọi trực tiếp.

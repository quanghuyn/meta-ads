# Hợp đồng dữ liệu: những gì đã kiểm chứng

Kiểm tra ngày 28/10/2026 bằng gọi đọc thật qua connector của phiên chat. Bản chạy thật phải dùng API chính thức (xem `specs/03`); bảng dưới là bằng chứng về shape và ý nghĩa field. Mọi mục ghi `unverified` chưa có bằng chứng.

Mẫu đã dùng: ngày 27/10 (112 hội thoại, 16 đơn có giá trị) và sáng 28/10. Mẫu nhỏ hơn 30–50 ca mà task A3 yêu cầu, nên chưa phải nghiệm thu.

## Pancake Chat (page 196059750263125)

| Nguồn | Trường nội bộ | Kiểu / múi giờ | Trạng thái |
|---|---|---|---|
| `GET v2/pages/{page_id}/conversations` (`type=INBOX`, `since`, `until`, `order_by=inserted_at`, `last_conversation_id`) | danh sách hội thoại, 60 mỗi trang | cursor theo `last_conversation_id` | verified |
| `id` | conversation_id | text, dạng `{page_id}_{psid}` | verified |
| `inserted_at` | thời điểm hội thoại tạo | ISO không kèm múi giờ, là UTC | verified (suy từ giờ hiện tại) |
| `has_phone`, `recent_phone_numbers[].order_id` | có SĐT, đơn gắn với SĐT | boolean, danh sách | verified |
| `ad_ids[]`, `ads[].ad_id`, `ads[].inserted_at`, `ads[].post_id` | các lần chạm quảng cáo kèm giờ | `ads[].inserted_at` có thể sau `inserted_at` của hội thoại; một hội thoại có thể có nhiều ad | verified |
| `tags[].text` | thẻ sale | danh sách, có phần tử `null` | verified |
| `statistics/pages` | `hour`, `new_inbox_count`, `phone_number_count` | `hour` là giờ VN | verified |
| Bộ lọc `since`/`until` nghĩa là created hay updated | | | unverified (kết quả trả về đều có `inserted_at` trong khoảng) |
| Thời điểm đầu tiên khách nhắn (first inbound) | | | unverified: đang dùng `inserted_at` |

## Pancake POS (shop 1546758)

| Nguồn | Trường nội bộ | Ghi chú | Trạng thái |
|---|---|---|---|
| `order list` với `order_sources=[["-1","196059750263125"]]`, `update_status=inserted_at`, `start/end_date_time` | đơn theo ngày tạo | `aggs.cod.value` = `aggs.total_price.value` trong mọi lần gọi | verified |
| `total_price_after_sub_discount` | Total Sale mỗi đơn | bằng `cod` ở mọi đơn đã xem (prepaid = 0) | verified, cần kiểm đơn prepaid > 0 |
| `total_price` mỗi đơn | không dùng | thấp hơn tiền khách trả khoảng 6–7% | verified |
| `status` | trạng thái đơn | đã thấy 0, 1, 2, 6, 9, 11. Mã 6 và 11 chưa đối chiếu tài liệu | unverified |
| `conversation_id` | khóa nối đơn với hội thoại | trùng `id` hội thoại Chat trên 1 mẫu | verified 1 mẫu, cần 30–50 mẫu |
| `ad_id` | quảng cáo của đơn | 1 giá trị, có thể null | verified |
| `inserted_at` | ngày tạo đơn | UTC không kèm múi giờ | verified (suy từ giờ hiện tại) |
| Đơn trạng thái 0 giá trị 0đ | không phải đơn bán | tự tạo khi khách để lại SĐT; ngày 27/10 có 50 trong 80 đơn | verified |
| Đơn bị hoàn/hủy sau ngày tạo (đơn cũ) | | | unverified |

## Meta Ads

| Nguồn | Trường nội bộ | Ghi chú | Trạng thái |
|---|---|---|---|
| Insights `level=ad`, 1 ngày | `ad_id`, `campaign_name`, `spend` | thay thế snapshot, không cộng dồn | verified |
| Insights `level=campaign` | mess = `onsite_conversion.messaging_conversation_started_7d` | Meta tính theo ngày hiển thị quảng cáo, khác Pancake | verified |
| `ads_get_ad_entities` với `object_ids` | `ad_id` sang campaign/adset | chỉ Nam Khoa 2 (Nam Khoa 3 chưa được Meta mở cho công cụ này) | verified |
| Múi giờ và tiền tệ Nam Khoa 2 / Nam Khoa 1 | Asia/Ho_Chi_Minh, VND | | verified |
| Múi giờ Nam Khoa 3 | | | unverified |

## Cách ghép đã dùng để đánh giá chiến dịch

1. Hội thoại → quảng cáo bằng `ads[]` (lần chạm đầu).
2. Quảng cáo → chiến dịch bằng `ad_id` ở Meta.
3. Đơn → quảng cáo bằng `ad_id` của đơn. Nên chuyển sang nối qua `conversation_id` rồi lấy quảng cáo của hội thoại, và đối chiếu với `ad_id` của đơn.
4. Quảng cáo không thuộc tài khoản nào đã biết (mã dạng `52707…`, `120257142062100211`) để riêng là chưa ghép, không phân bổ.

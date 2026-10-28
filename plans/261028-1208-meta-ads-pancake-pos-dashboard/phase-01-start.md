---
title: "Kiểm chứng dữ liệu và định nghĩa"
status: pending
phase: 1
effort: "2–3 ngày"
dependencies: []
---

# Giai đoạn 1: Kiểm chứng dữ liệu và định nghĩa

## Bối cảnh và yêu cầu

Chưa có repo/quyền API. [Inbox API](https://developer.pancake.biz/) có conversations/tags/webhook; [POS Open API](https://docs.pancake.biz/pos/st-f13/st-p1?lang=en) có orders/products/customers. Quan hệ order–conversation, `ad_id`, lịch sử referral và lịch sử qualification chưa được kiểm chứng. [Meta SDK](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adsinsights.py) xác nhận các trường Insights; scope, quyền và payload phải kiểm tra trên tài khoản được cấp.

## Tệp đề xuất trong repo tương lai

Tạo `docs/metric-definitions.md`, `docs/data-contracts.md`, `docs/source-access.md`; báo cáo đã loại PII trong thư mục kế hoạch `reports/`. Chưa cần mã ứng dụng; không có tệp phải xóa.

## Các bước

1. Xác nhận ID của 2 ad account, 1 page, 1 shop đã chốt; mapping, timezone, currency, Total Sale report basis và quyền tối thiểu. Kiểm tra tài liệu hiện hành về token, phân trang, quota, webhook authentication và retry.
2. Lấy 30–50 ví dụ thật có kiểm soát quyền: paid/organic, nhiều đơn, thiếu referral, đổi tag, hủy/hoàn. Ghi field/type/nullability, source ID và timestamps; không đưa PII/token vào Git.
3. Phạm vi đã chốt 2 ad account, 1 page, 1 shop. Revenue là Total Sale khớp đúng báo cáo POS về status/date/discount/ship/returns; không tự thay thành delivered revenue/cash collected hay trừ hủy tùy ý. Ghi basis trên UI. Chứng minh order–conversation bằng khóa rõ ràng trước. Customer đúng scope hoặc phone chuẩn hóa duy nhất chỉ là fallback được duyệt; mơ hồ để rà soát.
4. Chứng minh conversation–ad bằng `ad_id` thực tế. Thiếu/không xác minh được để Unattributed; Organic chỉ khi có căn cứ. Không suy đoán từ tên adset hoặc chia revenue theo spend.
5. Đề xuất mỗi đơn chọn tối đa một paid touch hợp lệ gần nhất trong 7 ngày trước đơn; tie-break/window có cấu hình và version. Đơn không ghép được vẫn giữ trong doanh thu shop.
6. Chốt CIR = spend/attributed Total Sale; internal ROAS = attributed Total Sale/spend; MER = toàn bộ shop Total Sale/spend. Meta-reported ROAS có nhãn và quy tắc riêng. CPA paid = spend/số đơn paid được attribution cùng phạm vi. CTR all = all clicks/impressions; link CTR = link clicks/impressions; CPM = spend/impressions × 1.000; AOV = Total Sale/số đơn cùng basis. Các tỷ lệ phần trăm nhân 100; định nghĩa số đơn phải khớp báo cáo nguồn.
7. Người dùng chọn qualified theo rules nhu cầu + có SĐT (không điều kiện khu vực). Đã chốt: nhu_cau_phu_hop (XTS/RLCD) AND co_sdt, không có điều kiện khu vực. Dùng structured fields/customer/phone, chỉ đọc nội dung tin nhắn giới hạn khi cần; không AI trong MVP. Text mơ hồ, phủ định để pending/manual review. Thẻ XTS/RLCD là evidence nhu cầu; các thẻ còn lại đánh giá chất lượng sau SĐT, không đổi định nghĩa qualified.
8. Chốt qualified rate = qualified conversations/eligible dedup conversations cùng cohort; close rate = qualified conversations có chuyển đổi/qualified conversations cùng cohort/window. Một conversation nhiều đơn chỉ tính một conversion; orders/mess có thể >100%. Tách ngày Total Sale vận hành khỏi ngày cohort; cohort chưa đủ window có nhãn. Lưu evidence/source/version/evaluated_at từng predicate và audited override có nguồn; snapshot hiện tại không dựng lịch sử qualification.

## Kiểm chứng và tiêu chí hoàn tất

- [ ] 30–50 mẫu có kết quả matched/unmatched/ambiguous và lý do; không áp coverage target tùy tiện.
- [ ] Định nghĩa eligible, chi tiết rule/predicates, Total Sale source report basis, scope và window được chốt; giới hạn lịch sử rõ. Mẫu 30–50 được rà soát thủ công, có truth table và regression cases cho rule.
- [ ] Tính tay CIR/ROAS/MER/CPA/CTR all/link/CPM/AOV/funnel khớp. Tổng tỷ lệ lấy tổng tử/tổng mẫu, không trung bình subgroup; mẫu số 0 trả N/A.
- [ ] Threshold CIR 45% tương đương ROAS mục tiêu khoảng 2,22. Chênh 45% − CIR là dư địa so mục tiêu, không phải lợi nhuận hoặc hòa vốn kế toán.

## Rủi ro và quay lui

Không có khóa nối sẽ hạn chế ROAS theo adset. Chỉ tiếp tục phần đó khi có bằng chứng; nếu không giữ shop MER và Unattributed, trình giới hạn để người dùng quyết định phạm vi. Chưa đổi production nên quay lui bằng sửa data contract và kế hoạch.

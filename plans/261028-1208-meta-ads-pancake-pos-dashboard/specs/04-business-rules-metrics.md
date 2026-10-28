# Quy tắc qualification, attribution và chỉ số

Tất cả logic ở đây là hợp đồng nội bộ để viết code/test. Các mặc định được đề xuất phải có trạng thái draft cho đến khi nghiệp vụ được xác nhận; không trộn quy tắc đề xuất với quyết định đã chốt.

## Đơn vị hội thoại và eligibility

Một hội thoại duy nhất theo workspace + page connection + conversation ID. Nhiều tin nhắn không tăng số mess; cùng khách quay lại trong một conversation không tự tạo lead mới. MVP không có episode splitting. Khách trên hai ad account về cùng page vẫn một conversation.

eligible là inbound khách thật thuộc inbox và phạm vi đo. excluded cần bằng chứng spam/bot/test hoặc channel không thuộc phạm vi; unknown nếu chưa đủ dữ liệu. Chỉ eligible vào mẫu số quality; hiện số excluded/unknown riêng để người xem biết phạm vi. Một khách không phù hợp nhu cầu vẫn là eligible nhưng unqualified, không loại khỏi mẫu số để tăng qualified rate.

## Rule configuration

Ví dụ cấu trúc cấu hình, không seed danh mục giả:

```text
version: số nguyên
state: draft | active | retired
combination: all_required
required_predicates: need_match, phone_present   # service_region_match không bật (quyết định 28/10/2026)
allowed_product_codes: XTS, RLCD, XTS_RLCD (đã chốt 28/10/2026)
allowed_region_codes: không dùng (không có điều kiện khu vực)
phone_rule: chỉ cần có SĐT, không kiểm tra định dạng
evidence_sources: danh sách nguồn đã kiểm chứng
effective_at, confirmed_by, confirmed_at
```

Chỉ hỗ trợ all_required ở MVP; form có từng điều kiện bật/tắt bắt buộc. Không xây ngôn ngữ rule tùy ý, không eval JavaScript/SQL từ cấu hình. Chưa nhập danh mục bắt buộc hoặc chưa xác nhận thì rule không active.

Predicate result = pass | fail | unknown | conflict. Mỗi result kèm evidence IDs, reason_code, evidence_at và evaluated_at. Xử lý:

1. Eligibility excluded → excluded, không chạy quality để đưa vào funnel.
2. Rule chưa active hoặc có predicate bắt buộc conflict → pending.
3. Một predicate bắt buộc fail có bằng chứng chắc chắn → unqualified.
4. Không fail, nhưng có unknown/conflict chưa giải quyết → pending.
5. Mọi predicate bắt buộc pass → qualified.

Nếu conflict nằm trong predicate quyết định thì không chọn bằng chứng có lợi tùy ý. Chọn evidence theo ưu tiên đã cấu hình: structured nguồn đáng tin → manual bổ sung đã audit → extractor chắc chắn; khi cùng mức có mâu thuẫn thì pending. Manual override tách riêng, không sửa dữ liệu nguồn; có actor/reason/expiry nếu áp dụng và hiển thị rõ trên UI.

## Cách xác định từng điều kiện

| Điều kiện | Pass | Fail | Unknown/conflict |
|---|---|---|---|
| Nhu cầu | Field sản phẩm/nhu cầu cấu trúc đúng danh mục hoặc mẫu câu có ngữ cảnh rõ đã được duyệt | Ý định rõ thuộc nhóm không phục vụ | Từ khóa đơn lẻ, phủ định khó hiểu, thiếu thông tin hoặc evidence mâu thuẫn |
| SĐT | Có SĐT của khách trong hội thoại (`has_phone` hoặc `recent_phone_numbers`) | Không có SĐT | Nhiều số không rõ số nào của khách, số từ nhân viên/bot |
| Khu vực | Không áp dụng: predicate này không bật theo quyết định 28/10/2026 | Không áp dụng | Không áp dụng |

Không viết NLP tổng quát trong MVP. Chuẩn hóa Unicode, khoảng trắng và mẫu rõ ràng; ưu tiên field/selection cụ thể. Không dùng regex mù bắt mọi chuỗi số thành phone; không chọn số từ báo giá/mã đơn. Không gọi external AI API. SĐT valid không có nghĩa đã xác minh chủ sở hữu.

Thời điểm evidence xuất hiện phải được giữ. Evidence lấy lần đầu từ đơn sau mua không được backdate qualification trước mua. Khi người dùng đổi rule, tạo version mới; tái đánh giá lịch sử là job có lựa chọn và audit, không cập nhật ngầm các kết quả cũ.

## Cohort và cửa sổ chuyển đổi

Đề xuất cohort_origin = first_inbound_at thực có bằng chứng, conversion_window = 7 ngày. Không biết first_inbound thì hiển thị unknown-cohort và không ghép vào ngày quan sát như ngày khởi tạo thật. historical snapshot được hiển thị riêng.

Để tính qualified close rate theo lịch sử: xác định thời điểm đạt qualified trước hoặc tại đơn chuyển đổi hợp lệ đầu tiên trong cửa sổ. Qualified được suy ra chỉ từ dữ liệu sau đơn không làm tăng tử số chốt qualified. Số hội thoại qualified được đánh giá đến cutoff của cohort; report trả evaluation_as_of/rule_version để tái hiện. Khi chưa đủ 7 ngày, cohort mature=false và số còn có thể thay đổi.

Tại as_of, cutoff mỗi conversation = min(as_of, first_inbound_at + window). Qualified cohort Q là tập eligible conversations có kết quả hữu hiệu mới nhất tại cutoff là qualified, trong rule version đang báo cáo và có evidence thời gian hỗ trợ. Không dùng cách đếm ever-qualified. Converted qualified C là tập con của Q có ≥1 đơn theo contract chuyển đổi, created_at trong [first_inbound_at, cutoff], và kết quả qualification hữu hiệu tại thời điểm đơn đó cũng là qualified. Vì C luôn thuộc Q, close rate không vượt100%. Ca qualified→mua→unqualified trước cutoff bị loại khỏi cả Q và C, nhưng vẫn có thể thuộc overall converted. UI nêu rõ đây là chất lượng tại cutoff, không “đã từng qualified”. Evidence không biết thời gian hoặc chỉ snapshot không được dựng lịch sử; giữ pending/unknown-history. Rule conflict/manual override giữ effective time và audit để quyết định được.

`asOf` trong MVP là cutoff nghiệp vụ cho evidence/conversion, không phải tính năng khôi phục những gì hệ thống từng biết ở thời điểm quá khứ. Orders/sale facts/eligibility/attribution dùng dữ liệu hiện tại đã restate theo version được chọn; response luôn có restatedAt và historicalKnowledgeSnapshot=false. Một kỳ quá khứ có thể đổi do cập nhật hoàn/hủy đến muộn. Không hứa reproducible point-in-time source state khi chưa lưu các snapshot tương ứng.

Tập đơn “chuyển đổi” là cấu hình riêng nhưng mặc định đề xuất dùng tập đơn được tính Total Sale, chờ xác nhận. Revenue basis ngày nhận doanh thu có thể khác order_created_at; attribution/conversion không đổi theo ngày sync hoặc ngày nhận tiền. Hoàn/hủy có thể làm thay đổi trạng thái chuyển đổi theo contract, được ghi rõ là báo cáo restated as_of, không cố giữ số sai.

## Ghép đơn và attribution

Thứ tự: link order→conversation nguồn đã xác minh; identity mapping khách giữa hai namespace đã xác minh; phone fallback chỉ khi duy nhất, đúng scope và khoảng thời gian phù hợp đã xác nhận. Nếu có hai conversation ứng viên thì ambiguous, không chọn newest tùy ý. Đơn không ghép vẫn tồn tại và tính trong shop Total Sale đúng contract.

Paid attribution đề xuất last observed paid touch trước/tại order_created_at, trong 7 ngày trước đơn, trên conversation đã ghép. Chỉ touch có source ad identity và timestamp đáng tin cậy mới đủ. Nếu hai ad khác nhau trùng thời điểm mà nguồn không có sequence đáng tin thì ambiguous; không tie-break bằng tên/ID để tạo độ chính xác giả. Một đơn có tối đa một active attribution; các touch khác chỉ là evidence.

Bucket paid/organic/other/unattributed. Organic cần bằng chứng; thiếu paid touch không mặc định organic. Unknown ad_id vẫn lưu source_ad_id để đồng bộ metadata lại; cho tới khi xác định account/ad hierarchy thì không gán vào một ad set tùy ý.

### Gán nguồn hội thoại để tính chất lượng theo Ads

Tách `conversation_attributions` khỏi `order_attributions`. Mỗi conversation chỉ có một active lead origin. Policy đề xuất: paid touch đáng tin gần nhất trước/tại first_inbound_at, trong cùng cửa sổ7ngày; thiếu/tie/không biết first_inbound thì unattributed/ambiguous với lý do. Source cung cấp liên kết acquisition rõ có thể dùng sau khi xác minh, không suy từ order cuối cùng. Khách quay lại từ Ads khác trong conversation cũ không đổi lead origin trong MVP không chia episodes.

Ads-filtered eligible/qualified/close-rate dùng conversation origin này, không join tất cả ad_touches. Conversion trong cohort đó có thể là bất kỳ đơn hợp lệ nối vào conversation trong cửa sổ, kể cả đơn có order attribution khác; vì vậy label là “chốt theo nguồn lead”. ROAS vẫn theo order attribution và có thể khác phân bố conversion-by-lead-origin. Cost/qualified chỉ tính khi spend và paid lead cohort tương thích ngày/account/currency; thiếu identity/timestamp cần thiết thì unavailable. Toàn shop vẫn xem chất lượng các hội thoại có đủ evidence.

## Reporting bases và KPI

Hai basis: operational và cohort. Không cho một query dùng date basis này cho tử số và basis khác không ghi nhãn cho mẫu số.

Operational dùng spend theo source reporting date và Total Sale theo recognition_date của contract. Đây là tỷ số cùng kỳ, có thể phản ánh doanh thu từ khách đến kỳ trước. Cohort lấy tập hội thoại phát sinh trong khoảng ngày và theo dõi conversion; spend cùng ad/date chỉ là chi phí tập ngày, không tracking từng người. Các đơn không có conversation cohort không đưa vào cohort revenue nhưng vẫn hiện trong operational/unattributed.

| Key | Công thức | Phạm vi |
|---|---|---|
| total_sale | SUM amount facts thuộc active contract/included | Toàn shop khi không lọc Ads |
| attributed_sale | SUM sale facts của đơn paid thuộc tập Ads | Cùng contract, mỗi fact một lần |
| ad_spend | SUM daily spend active query profile | Accounts/ad/date đã chọn |
| mer | shop total_sale / spend toàn bộ 2 account được chọn cho MER toàn shop | Không áp campaign filter rồi vẫn gọi MER toàn shop |
| roas | attributed_sale / ad_spend | Ads filter + date basis rõ |
| cir | ad_spend / attributed_sale × 100 | Nhãn CIR Ads |
| cpa | ad_spend / COUNT DISTINCT eligible paid order | Cùng tập đơn và thời gian |
| aov | total_sale hoặc attributed_sale / distinct orders cùng scope | Không chia theo fact rows |
| ctr_all, ctr_link | clicks cùng loại / impressions ×100 | Null link clicks giữ null |
| cpc_all, cpc_link | spend / clicks cùng loại | Không trộn all/link |
| cpm | spend / impressions ×1000 | Không trung bình CPM từng ad |
| qualified_rate | qualified eligible conversations / eligible conversations ×100 | Cùng cohort/version/as_of |
| cost_per_qualified | spend tập paid/ngày / qualified paid cohort cùng tập | Nếu nguồn/cấu hình thiếu thì unavailable |
| qualified_close_rate | unique converted-qualified conversations / unique qualified conversations ×100 | Theo thời điểm qualification và cửa sổ |
| overall_close_rate | unique converted conversations / eligible conversations ×100 | Không dùng số đơn làm tử số |
| orders_per_conversation | eligible orders / eligible conversations | Riêng, có thể >100% |
| attribution_coverage_orders | paid attributed orders / eligible shop orders ×100 | Chỉ scope shop, nêu denominator |
| attribution_coverage_value | paid attributed sale / shop Total Sale ×100 | Chỉ hiển thị tỷ lệ khi denominator >0 và không có fact âm gây tỷ lệ khó diễn giải |

Coverage paid không phải match accuracy: shop có organic nên tỷ lệ paid thấp không tự là lỗi. Hiện thêm số có identity link, số ambiguous/unattributed và lý do. Khi có adjustment âm, ưu tiên số tiền theo bucket, không clamp coverage về 0–100. Target coverage phải định nghĩa theo các đơn paid có bằng chứng, không đặt ngưỡng tùy tiện toàn shop.

Mẫu số 0 → value=null, status=not_applicable; denominator âm hoặc net revenue không phù hợp để đánh giá → value=null và reason giải thích, vẫn hiển thị revenue gốc. Dữ liệu thiếu → unavailable/partial; dữ liệu cũ → stale. Không xử lý tất cả null thành zero. Ratio tính từ SUM numerator/SUM denominator.

CIR 45% và ROAS 2,22 là mục tiêu đã chốt ngày 28/10/2026 (cấu hình có version, không hardcode); 45% − CIR là điểm phần trăm dư địa tới mục tiêu, không lợi nhuận. Toàn bộ số screenshot chỉ dùng kiểm tra logic, không seed production.

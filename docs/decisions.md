# Quyết định của chủ dự án (28/10/2026)

File này ghi đè mọi mô tả cũ trong kit khi có mâu thuẫn. Thứ tự ưu tiên: file này, rồi specs chi tiết, rồi phase.
Mục "Chờ xác nhận" chưa được chốt: làm dưới dạng cấu hình draft, không tự quyết.

## Đã chốt

| # | Quyết định | Ghi chú triển khai |
|---|---|---|
| D1 | Total Sale = tổng `total_price_after_sub_discount` của đơn POS shop 1546758, nguồn đơn Facebook page 196059750263125, tính theo ngày tạo đơn (`inserted_at`, đổi sang giờ VN), chỉ các trạng thái 1, 2, 3, 8, 9, 11, 12, 13, 16, 17. Không tính trạng thái 0 (Mới), 4, 5, 6, 7, 15. | Chủ dự án xác nhận cách tính này khớp tổng Pancake (27/10: 50.479.985đ). Trường `cod` bằng giá trị này ở mọi đơn đã xem (prepaid = 0); phải kiểm lại khi có đơn trả trước. Không dùng `total_price` của từng đơn (thấp hơn tiền khách trả). Ý nghĩa các mã trạng thái 6 và 11 chưa đối chiếu với tài liệu POS. |
| D2 | Nhu cầu hợp lệ: XTS, RLCD, XTS + RLCD. Không nhóm khác. | Bằng chứng: thẻ XTS / RLCD / "XTS + RLCD" trên hội thoại, ghi chú khách là bằng chứng phụ. Ánh xạ này vẫn là draft cho tới khi đối chiếu 30–50 mẫu. |
| D3 | Không có điều kiện khu vực. | Predicate `service_region_match` không bật, không có allowlist vùng. |
| D4 | SĐT: chỉ cần có SĐT, không kiểm tiêu chí định dạng. | Predicate là `phone_present`. Nguồn: `has_phone` / `recent_phone_numbers`. |
| D5 | Thẻ sale dùng để đánh giá chất lượng mess sau khi có SĐT. | Thẻ không thay định nghĩa qualified. Qualified = eligible + `need_match` + `phone_present`. Tầng chất lượng là phần riêng, xem "Chờ xác nhận" 1. |
| D6 | Mục tiêu CIR 45% (ROAS hòa vốn ≈ 2,22x). Dư địa = 45% − CIR, đơn vị điểm phần trăm, không phải lợi nhuận. | Ngưỡng là cấu hình có version, không hardcode. Ảnh mẫu ghi "Trần 35%" chỉ là ví dụ. |
| D7 | Hiện có 2 tài khoản quảng cáo: Nam Khoa 2 (1492352028605038) và Nam Khoa 3 (1114645597047575). Sau này sẽ thêm. | Thiết kế cho N tài khoản, không hardcode số lượng hay ID. Nam Khoa 1 (1240787304172940) chưa bỏ nhưng không tính vào báo cáo: giữ connection ở trạng thái tắt. |
| D8 | Người dùng: team marketing (admin + marketing). | Vai trò sales ngoài phạm vi MVP. Schema giữ nguyên cột role để mở sau. Bỏ các màn hình dành riêng cho sales (phân công, override theo phân công). |
| D9 | Thư mục dự án: `~/Documents/meta-ads-dashboard`. | Chưa `git init`; kit yêu cầu không commit/push khi chưa được cho phép. |

## Chờ xác nhận (làm draft, không tự quyết)

1. **Ánh xạ thẻ sale → mức chất lượng sau SĐT.** Đề xuất: tốt = Chốt đơn, Hẹn khám, Đã báo giá, Khách tiềm năng, Chăm tiếp, Tư vấn zalo; không đạt = Ko có nhu cầu; trùng = Trùng khách; sau bán = Đã nhận thuốc. Thẻ XTS / RLCD / "XTS + RLCD" là nhãn nhu cầu, không phải chất lượng.
2. **"Trùng khách".** Khoảng 1/4 hội thoại có thẻ này. Đề xuất: vẫn là eligible, nhưng không vào qualified mới, báo riêng.
3. **Cửa sổ attribution 7 ngày**, quy tắc paid touch đầu tiên cho nguồn hội thoại và gần nhất trước đơn cho đơn hàng.
4. **Múi giờ Nam Khoa 3** chưa kiểm tra. Nam Khoa 2 và Nam Khoa 1 là Asia/Ho_Chi_Minh.
5. **Quảng cáo ngoài các tài khoản đã biết.** Ngày 28/10 có 3 đơn (khoảng 9,7 triệu) gắn mã quảng cáo không thuộc Nam Khoa 2 hay 3. Cần xác định tài khoản sở hữu.
6. **Token chính thức cho bản chạy thật:** Meta (quyền `ads_read`), page Pancake, khóa POS. Chỉ cất trong kho bí mật của Supabase/Vercel, không dán vào chat. Hai token page Pancake đã dán trong chat nên tạo lại.
7. **Môi trường:** máy chưa cài Node/npm, chưa thể scaffold và chạy test web. Connector GitHub đang lỗi `Authorization header is badly formatted`.

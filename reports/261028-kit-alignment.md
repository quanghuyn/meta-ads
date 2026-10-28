# Báo cáo 28/10/2026: chốt quyết định và cập nhật kit

## Đã làm
- Giải nén kit vào `~/Documents/meta-ads-dashboard`.
- Viết `docs/decisions.md` (9 quyết định đã chốt, 7 mục chờ xác nhận) và `docs/data-contracts.md` (bằng chứng đã kiểm).
- Sửa kit cho khớp quyết định: qualified = nhu cầu XTS/RLCD + có SĐT (bỏ khu vực và tiêu chí định dạng SĐT), CIR 45%, thẻ sale là tầng chất lượng sau SĐT, vai trò admin + marketing, thiết kế cho N tài khoản quảng cáo. Con trỏ tới `docs/decisions.md` nằm đầu `CLAUDE.md`.
- Các file đã sửa: `CLAUDE.md`, `README.md`, `START-HERE.md`, `plan.md`, 5 phase, specs 01, 03, 04, checklist và bản `handoff/`.

## Chưa làm / chưa kiểm
- Chưa viết code ứng dụng. Máy chưa có Node/npm nên chưa scaffold hay chạy test được.
- Chưa `git init`; connector GitHub đang lỗi xác thực.
- Specs 02 (schema), 05 (API/UI), 06 (test) chưa sửa: vẫn nhắc role sales và cấu trúc bảng rule theo predicate khu vực. Cần rà khi viết migration.
- Dữ liệu mẫu mới 2 ngày, chưa đủ 30–50 ca của task A3.

## Blocker
1. Cài Node (hoặc dùng môi trường khác) để scaffold Next.js.
2. Token chính thức Meta, Pancake page, POS cho worker. Nên tạo lại hai token page đã dán trong chat.
3. Nối lại connector GitHub nếu muốn repo private.

## Bước tiếp theo
Task A2/A3 hoàn tất bằng mẫu 30–50 ca, sau đó B1 (scaffold) và B2 (migrations), có thể làm khi có Node.

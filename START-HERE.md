# Prompt giao Claude Code triển khai

Giải nén bộ kit vào thư mục dự án. Nếu đã có CLAUDE.md, yêu cầu Claude hợp nhất thay vì ghi đè. Có thể dùng repo mới trống hoặc repo hiện có sau khi khảo sát. Bộ kit chứa tài liệu và ảnh mẫu, chưa có ứng dụng.

Copy toàn bộ prompt dưới đây vào Claude Code khi đang mở thư mục dự án:

```text
Hãy triển khai dashboard web nội bộ theo bộ kế hoạch trong repo này.

Đọc CLAUDE.md, docs/decisions.md, docs/data-contracts.md, AGENTS.md nếu có, sau đó:
- plans/261028-1208-meta-ads-pancake-pos-dashboard/plan.md
- plans/261028-1208-meta-ads-pancake-pos-dashboard/implementation-checklist.md
- toàn bộ specs/ trong thư mục kế hoạch
- assets/dashboard-reference.png

Phạm vi đã chốt: 2 tài khoản Meta Ads, 1 Pancake fanpage, 1 Pancake POS shop;
Total Sale theo đúng báo cáo POS; qualified mess theo quy tắc nhu cầu + có SĐT (không điều kiện khu vực).
Stack GitHub + Vercel + Supabase; kiến trúc chi tiết trong specs.

Bắt đầu bằng khảo sát repo, lập checklist thực thi ngắn và triển khai phần có thể làm ngay.
Tôi yêu cầu viết code, không chỉ viết lại kế hoạch. Thực hiện các task theo dependencies
đến khi phạm vi triển khai được hoàn tất hoặc chỉ còn blocker thật cần tôi cung cấp.

Xác minh endpoint/field/status/permissions bằng tài liệu và payload thật trước khi map nguồn.
Không bịa source fields, không tạo demo data production, không gọi đã tích hợp xong khi chưa đối soát.
Nếu chưa có credentials, vẫn làm scaffold, schema, Auth/RLS, domain engine, API contracts,
UI empty states và tests; ghi chính xác nguồn/tác vụ còn blocked.

Các cấu hình nghiệp vụ đã chốt nằm ở docs/decisions.md; đọc file đó trước. Còn chờ xác nhận: ánh xạ thẻ sale sang mức chất lượng,
xử lý "Trùng khách", cửa sổ attribution. Tạo form draft/validation cho các mục này và chỉ hỏi khi cần kích hoạt phần tính toán tương ứng.
Không dừng toàn bộ công việc để chờ câu trả lời cho phần độc lập có thể làm tiếp.

Chạy tests phù hợp, lint/typecheck/build và Deno checks. Cập nhật checklist và reports/
sau mỗi nhóm task. Bảo toàn Total Sale, không nhân spend qua joins, không backdate qualification
từ thông tin sau mua; nguồn chưa ghép phải hiện riêng với lý do.

Phạm vi hiện tại là triển khai code và kiểm thử local/staging nếu môi trường đã được cấp.
Chuẩn bị cấu hình GitHub/Vercel/Supabase để review; không mua gói, tạo public repo,
đổi webhook production hoặc deploy production khi chưa có quyền thực hiện trong phiên này.

Khi kết thúc, báo: chức năng đã chạy; test đã chạy và kết quả; cách chạy local;
thông tin tôi còn cần cung cấp; giới hạn dữ liệu; bước tiếp theo cụ thể.
```

## Prompt tiếp tục ở phiên sau

```text
Tiếp tục triển khai dashboard từ trạng thái hiện có. Đọc CLAUDE.md, plan.md,
implementation-checklist.md và reports mới nhất. Kiểm tra git diff và các task đã hoàn tất;
không scaffold lại hay ghi đè thay đổi hiện có. Làm task tiếp theo có đủ dependencies,
kiểm thử và cập nhật tiến độ. Giữ nguyên các quyết định nghiệp vụ đã chốt.
```

## Dữ liệu chủ dự án cần cung cấp khi tích hợp

IDs 2 ad account, page và shop; quyền/token qua secret store; báo cáo Total Sale mẫu đúng filter;
xác nhận ánh xạ thẻ sale và cửa sổ attribution; timezone/currency; thời gian lịch sử cần lấy.
Không paste token hoặc dữ liệu cá nhân vào prompt này.

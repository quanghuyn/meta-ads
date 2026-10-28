# Báo cáo 28/10/2026: B1 scaffold

## Đã làm
- `git init` local (chưa commit, chưa remote) và `.gitignore` chặn `.env*`, `node_modules`, `.next`.
- Scaffold Next.js 16.4.3 (App Router, TS strict, Tailwind 4, ESLint) bằng npm, một `package-lock.json`.
- Thêm zod, recharts, @supabase/supabase-js, @supabase/ssr, vitest, @playwright/test; nâng `@types/node` lên 24 (vitest 5 không chạy với ^20).
- Script: dev, build, lint, typecheck (`next typegen && tsc --noEmit`), test, test:e2e. `.env.example` chỉ có placeholder.
- Thư mục `tests/unit`, `supabase/functions/_shared/domain` (tạo sẵn cho domain logic dùng chung).

## Kiểm tra
typecheck, lint, vitest (1 smoke test), build đều đạt. Playwright chưa có config/test.

## Chưa làm
- shadcn/ui chưa init (cần `npx shadcn init`); trang `/` vẫn là mẫu mặc định của create-next-app, chưa thay.
- Chưa có CI skeleton (`.github/workflows/ci.yml`), supabase/config.toml.
- B1 chưa hoàn tất hẳn: còn shadcn + CI. Tiếp theo B2 (migrations), C1 (domain money/date/metrics).

## Bổ sung: trang demo (cùng ngày)
- `/demo` (và `/` chuyển hướng tới đó): 6 KPI, CIR theo chiến dịch với ngưỡng 45%, biểu đồ chi tiêu/Total Sale/ROAS (hai trục riêng, vạch ROAS hoà vốn 2,22x), phễu, donut đóng góp, CTR/CPM/AOV và bảng số liệu.
- Dữ liệu mẫu ở `src/app/demo/sample-data.ts`, lấy từ ảnh tham chiếu và có banner "DỮ LIỆU MẪU". Phải xoá `src/app/demo` trước production.
- Chỉnh so với ảnh: ngưỡng 35% → 45% (quyết định D6); impressions/clicks mẫu đặt lại để CTR nhất quán (ảnh ghi 907 click không khớp 2,65%); tỷ lệ chốt tính trên hội thoại qualified có đơn, không lấy số đơn chia mess. Số qualified (41) và converted (24) là số giả định của demo.
- Chưa làm: lọc theo ngày/tài khoản, trạng thái loading/not_configured, mobile chưa chụp kiểm tra bằng mắt.

## Bổ sung: báo cáo dữ liệu thật 7 ngày (22–28/10/2026)
- Trang `/bao-cao` (`/` chuyển tới đây) dùng ảnh chụp dữ liệu thật ở `src/app/bao-cao/real-data.ts` (tổng hợp theo ngày, không PII), có bộ chọn: Hôm nay, Hôm qua, 3 ngày, 7 ngày, từ–đến. `/demo` vẫn là dữ liệu mẫu.
- Nguồn: Meta Nam Khoa 2 (1492352028605038, kênh Meta Ads MCP, khớp tổng 139.721.974đ) và Nam Khoa 3 (1114645597047575, qua ADS Noti vì Meta Ads MCP chưa mở cho tài khoản này); POS shop 1546758, nguồn FB page, trạng thái theo D1, 97 đơn.
- Kết quả 7 ngày: chi tiêu 180.079.636đ (NK2 139,72tr + NK3 40,36tr), Total Sale 311.459.925đ, CIR 57,8% (vượt 45%), ROAS 1,73x (hoà vốn 2,22x), CPA 1,86tr, AOV 3,21tr. CIR theo ngày: 40,8 / 55,0 / 68,0 / 103,5 / 62,3 / 62,9 / 33,8% (28/10 chưa trọn ngày).
- Giới hạn: (1) CIR là chi phí NK2+NK3 chia Total Sale cả shop, không phải doanh thu gán Ads; ad_id trên đơn chưa xác minh thuộc NK2/NK3. (2) NK3 lấy qua công cụ không có con trỏ phân trang, chưa kiểm tổng với Meta. (3) Tổng `total_price_after_sub_discount` 311.459.925 lệch `cod` 311.409.925 đúng 50.000 (có đơn prepaid): D1 cần kiểm lại. (4) Chưa có hội thoại, nên chưa có qualified/tỷ lệ chốt. (5) Dữ liệu nhập tay vào file, chưa có worker đồng bộ.

## Bổ sung: số liệu hội thoại từ Pancake (22–28/10)
- Nguồn: `GET /pages/196059750263125/statistics/pages` (hourly, giờ VN), gộp theo ngày vào `real-data.ts`: `inbox` = Σ new_inbox_count (885 / 7 ngày), `phones` = Σ uniq_phone_number_count (432). Theo ngày hội thoại/SĐT: 213/104, 143/71, 122/54, 142/68, 99/47, 112/55, 54/33.
- Giới hạn: số này là mọi hội thoại inbox mới của page, không chỉ từ quảng cáo; chưa tách qualified (nhu cầu XTS/RLCD + SĐT) nên chưa có tỷ lệ chốt. `statistics/tags` chỉ cho biến động nhãn theo ngày gắn (ngày 22/10 có đợt gắn hàng loạt), không dùng làm cohort. Liệt kê từng hội thoại qua `/conversations` bị cắt ở khoảng 30 bản ghi/lượt khi gọi qua công cụ này; cần worker.

## Bổ sung: CIR theo tên chiến dịch Meta (22–28/10)
- Dữ liệu ở `src/app/bao-cao/campaign-data.ts`, bảng "5. CIR theo tên chiến dịch" trên `/bao-cao`. Nối đơn → chiến dịch bằng `ad_id` (Nam Khoa 2 qua Meta Ads MCP `object_ids`; Nam Khoa 3 qua ADS Noti level `ad`). Chi tiêu 7 ngày theo chiến dịch lấy cùng nguồn.
- Kết quả: 68/97 đơn (213,5tr) gán được vào chiến dịch NK2/NK3; 17 đơn (57,6tr) có ad_id ngoài NK2/NK3; 12 đơn (40,4tr) không có ad_id. CIR trên phần gán được = 173,3tr / 213,5tr = 81,2% (vượt 45%); nhiều chiến dịch chi nhiều nhưng 0 đơn.
- Giới hạn: tổng chiến dịch NK2 (132,84tr) thấp hơn tổng tài khoản (139,72tr) 6,88tr, chưa giải thích (trang sau chỉ có chiến dịch chi tiêu 0). `ad_id` trên đơn là một giá trị/đơn, chưa đối chiếu qua conversation. 2 chiến dịch cũ (17.9, 22.9) có đơn nhưng chi tiêu 0 trong kỳ. Ảnh chụp thủ công, chưa có worker.

## Cập nhật lần 2 (28/10): đính chính và làm mới số liệu
- Khoản chênh 6,88tr giữa tổng chiến dịch NK2 và tổng tài khoản là chiến dịch **"22.9"** (id 120234031611850686, chi tiêu 6.881.101đ, 3 đơn / 9,08tr, CIR 75,8%), không phải chiến dịch bị xoá: lần trước nằm ngoài các trang đã duyệt. Sau khi thêm, tổng chiến dịch NK2 = 139.943.040 so với tổng tài khoản 139.941.412 (chênh 1.628đ do hai lần gọi lệch thời điểm). Mục "chiến dịch xoá" ở ghi chú trước là suy đoán, không đúng.
- Làm mới 28/10: NK2 6.412.652đ, NK3 5.832.227đ; hội thoại mới 57, SĐT 35; đơn POS không đổi (11 đơn, 35.059.994đ).
- CIR trên phần đơn gán được vào chiến dịch NK2/NK3: 180,47tr / 213,50tr = 84,5%. 17.9 là chiến dịch cũ có 1 đơn nhưng 0 chi tiêu trong kỳ (chủ dự án xác nhận là đơn cũ chốt). `ad_id` một giá trị/đơn được chủ dự án chấp nhận.

## B2 (khởi đầu): schema + chuẩn hoá hội thoại Pancake
- 5 migration trong `supabase/migrations/` (workspace/membership/kết nối, ad entities + insights, hội thoại/bằng chứng/qualification/touch/attribution, đơn + fact Total Sale, sync jobs/checkpoints/audit) và 1 migration chính sách RLS. Mọi bảng bật RLS ngay khi tạo; `credential_ref` không cấp cho authenticated; bảng có SĐT/khách (conversations, evidence, orders…) không có policy cho authenticated.
- Kiểm bằng Postgres nhúng (PGlite) trong `tests/db/migrations.test.ts`: chạy sạch, mọi bảng public có RLS, ràng buộc 1 profile/1 attribution active, FK chéo workspace bị chặn, marketing đọc insights nhưng không đọc hội thoại/đơn/credential. Chưa chạy trên Postgres Supabase thật.
- `supabase/functions/_shared/domain/pancake-conversation.ts`: chuẩn hoá hội thoại (inserted_at UTC, nhãn, lần chạm ad; không lưu SĐT/nội dung), lỗi `SCHEMA_CHANGED` khi thiếu id/inserted_at. Có unit test.
- BLOCKER: tài khoản Supabase chưa có project (list_projects rỗng) nên chưa áp migration; chưa có token Pancake/Meta/POS trong secret store của worker. Chưa viết RPC báo cáo, claim job, worker HTTP.
- Còn thiếu để có CIR/CTR/CPM/qualified theo chiến dịch từ DB: sync Meta insights theo ad/ngày, sync hội thoại (60/trang qua `last_conversation_id`), RPC tổng hợp.

## B2: đã áp migration lên Supabase
- Project "Meta ads" (ref `btbsmfaakcorhluvkytx`, org quanghuyn's Org, gói Free, ap-northeast-1). Áp 6 migration theo thứ tự (bản áp lên project không có các dòng chú thích so với file trong repo, nội dung SQL như nhau). Phiên bản Supabase ghi nhận theo thời điểm áp, khác tiền tố timestamp của file local; cần thống nhất khi dùng Supabase CLI.
- Advisor bảo mật: chỉ 10 mục INFO `rls_enabled_no_policy` trên các bảng chứa dữ liệu khách/đơn/hàng đợi (conversations, evidence, orders, sale facts, ad_touches, attributions, qualification_results, sync_*, audit_events). Đây là chủ ý: authenticated không đọc trực tiếp, chỉ service_role/RPC. Không có cảnh báo mức cao hơn.
- Chưa có dữ liệu nào trong DB; chưa tạo workspace, kết nối, người dùng.

## Mục 5: đánh giá chi tiết theo chiến dịch, chỉ ngày 27/10
- `src/app/bao-cao/campaign-day-data.ts` + bảng mục 5 mới: chi tiêu, CPM, CTR, đơn, Total Sale, CIR, mess, SĐT, qualified, trùng, ko nhu cầu. Thay bảng 7 ngày cũ (`campaign-data.ts` còn nguyên, chưa dùng).
- Nhãn Pancake (ID): Trùng khách 28, Ko có nhu cầu 9, XTS 14, RLCD 15, XTS+RLCD 16. Đã kiểm lọc nhãn trả đúng nhãn. Lọc nhiều nhãn một lần (`tags=14,15,16`) trả rỗng nên lọc từng nhãn.
- Kiểm tổng: 112 hội thoại, 52 SĐT, 37 có nhãn nhu cầu (33 có cả SĐT), 23 trùng, 10 ko nhu cầu; 10 đơn gán chiến dịch (31,22tr) + 1 đơn ngoài NK2/3 + 5 đơn không ad_id = 50.479.985 khớp POS.
- Hội thoại tính theo ad_ids[0] (chạm đầu). Ad 120254056465140387 chưa xác nhận chiến dịch (nghi "26.10 - pk") nên để riêng.
- Nhãn là trạng thái hiện tại, không phải lúc hội thoại tạo; sale có thể gắn/gỡ nhãn sau.
- Chưa mở rộng sang các ngày khác theo yêu cầu.

## Mục 4 theo ảnh tham chiếu `wind-ads.png`
- Thay mục 4 cũ (đơn có/không ad_id + bảng theo tài khoản) bằng "Cơ cấu đóng góp doanh thu và so sánh chỉ số kỹ thuật": donut tỷ trọng Total Sale theo chiến dịch có đơn, kèm 3 khối thanh CTR, CPM, AOV (đánh dấu tốt nhất). Dùng dữ liệu 27/10 như mục 5; chưa theo bộ chọn ngày.
- Chưa xem bằng mắt trên trình duyệt; mới qua typecheck, lint và trang trả 200.

## Mục 1, 4, 5 theo chiến dịch và theo ngày
- `campaign-daily-data.ts`: chi tiêu (Meta NK2, ADS Noti NK3) và đơn POS theo chiến dịch × ngày, 22–28/10; đơn gán bằng ad_id. Test `tests/unit/campaign-daily.test.ts` đối chiếu tổng với số theo ngày (13 test đạt).
- Cập nhật dòng 27 và 28/10 trong `real-data.ts` (số mới từ Meta/POS: 28/10 có 13 đơn, 41.279.992đ).
- Mục 1: CIR theo chiến dịch với ngưỡng 45%, chọn ngày hoặc cả khoảng. Mục 4 và 5 theo khoảng ngày ở đầu trang; mục 5 thêm lọc tên, tài khoản, mức CIR, sắp xếp.
- Còn thiếu: cột hội thoại (mess, SĐT, qualified, trùng, ko nhu cầu) chỉ có cho 27/10; các ngày khác hiển thị "—". Chưa xem giao diện bằng mắt. Ad 120254056465140387 chưa xác nhận chiến dịch.

## Chuẩn bị deploy
- Xóa `src/app/demo`; hàm định dạng chuyển sang `src/lib/format.ts`, biểu đồ sang `src/app/bao-cao/charts.tsx`. Build production đạt (route `/` và `/bao-cao`).
- Mục 4: bỏ AOV, thêm CPC.
- BLOCKER deploy: chưa có repo GitHub "meta-ads" (không có công cụ tạo repo; GitHub MCP lỗi xác thực). Người dùng chọn deploy công khai. Dashboard chưa có đăng nhập, số liệu là ảnh chụp tĩnh 28/10.

## Worker đồng bộ (tự động), bước 1
- `supabase/functions/sync/index.ts`: Edge Function chỉ-đọc, `?job=pancake|pos&days=N`, xác thực bằng header `x-worker-secret` (secret `WORKER_TRIGGER_SECRET`). Đã deploy lên project Meta ads (verify_jwt=false, tự xác thực); gọi không secret trả 401.
- POS: `GET https://pos.pages.fm/api/v1/shops/1546758/orders` (docs chính thức, khóa qua `api_key`). Tên tham số lọc (`update_status`, `start_date_time`, `end_date_time`, `order_sources`) lấy theo schema của công cụ POS trong phiên chat; docs công khai chỉ ghi camelCase, CHƯA kiểm với API trực tiếp. Phải đối chiếu lần chạy đầu: 27/10 phải ra 16 đơn tính (đủ trạng thái), Total Sale 50.479.985.
- Pancake: `GET https://pages.fm/api/public_api/v2/pages/196059750263125/conversations`, trang 60, `last_conversation_id`. Nhãn lưu dạng bằng chứng (ảnh chụp hiện tại, thay mỗi lần chạy).
- Đã tạo workspace + 2 kết nối (inbox 196059750263125, pos 1546758) trong DB.
- Bản deploy là bản phẳng (import `./`) còn bản trong repo import `../_shared/...`; cần thống nhất khi dùng Supabase CLI.
- CHƯA làm: Meta (thiếu token), lịch chạy 30 phút, RPC tổng hợp, dashboard đọc từ DB. Chưa chạy thử với dữ liệu thật vì giá trị secret nằm ở phía người dùng.
- Thư mục chưa commit (chờ người dùng cho phép).

## Worker Meta (ADS Noti MCP)
- ADS Noti MCP (`https://mcp.done.vn/mcp?key=…`, khóa trong secret `ADSNOTI_MCP_URL`) có credential `ty3x…` chứa cả NK2 và NK3. Chỉ gọi `meta_get_insights` (chỉ đọc); metrics phải truyền tường minh (mặc định gây lỗi Facebook #100).
- Edge Function `sync-meta` (`supabase/functions/sync-meta/index.ts`, bản deploy là bản ASCII hoá chú thích) ghi `ad_entities` (campaign) và `ad_insights_daily` (profile `campaign-daily-v1`). Đã tạo 2 kết nối meta + profile trong DB.
- CHƯA chạy thật: giao thức MCP (initialize, session, SSE) viết theo chuẩn, chưa kiểm với máy chủ done.vn. Đối chiếu lần đầu: 27/10 NK3 = 12.776.137, NK2 = 18.973.776.
- Đã đối chiếu schema thật với worker `sync`: cột và ràng buộc khớp.

## Tự động đồng bộ: kết quả chạy thật (28/10)
- Lịch pg_cron mỗi 30 phút (POS :00/:30, Pancake :05/:35, Meta :10/:40, days=2) gọi Edge Function qua `public.call_sync_worker`, dùng token sinh trong vault (`x-cron-token`, kiểm bằng RPC `verify_cron_token`). Migration `20261028150000_schedule_sync_workers.sql`.
- POS: lọc nguồn đơn ở worker (`page_id`=196059750263125 và `order_sources`=-1). Đối chiếu: 27/10 = 16 đơn tính, 50.479.985 (khớp POS). 26/10 = 11 đơn/35.319.992; 28/10 (chưa hết ngày) = 18 đơn/58.579.987.
- Pancake: 904 hội thoại cho 7 ngày, ghi thành công.
- Meta qua khóa ADS Noti: credential của khóa khác credential trong chat nên worker tự dò bằng `meta_get_ad_accounts`. NK3 chạy được (27/10: 14 chiến dịch, 12.780.951, lệch số cũ 12.776.137 do Meta cập nhật muộn). NK2: lần đầu danh sách tài khoản rỗng; đã thêm retry, đang kiểm.
- Backfill 7 ngày POS vượt 120s của pg_net; lịch dùng days=2 nên không ảnh hưởng. Backfill nên chạy từng ngày.
- CHƯA làm: hàm tổng hợp trong DB, dashboard đọc từ DB, so sánh nhãn Pancake với cột trùng/không nhu cầu đã có.
- Meta NK2 chạy được sau retry: 27/10 = 18.976.828 (số cũ 18.973.776), NK3 = 12.780.969. Cả hai lệch vài nghìn do Meta cập nhật muộn.
- Đối chiếu hội thoại 27/10 từ DB: 112 hội thoại, trùng 23, không nhu cầu 10 (khớp). Có SĐT 54 (cũ 52), qualified 35 (cũ 33), có nhãn nhu cầu 39 (cũ 37): nhãn và SĐT là trạng thái hiện tại nên tăng theo thời gian. Tên nhãn thật là "XTS + RLCD" (có khoảng trắng), "Trùng khách", "Ko có nhu cầu".
- Dữ liệu từng ngày 22 đến 28/10 đã có trong DB cho cột hội thoại (trước chỉ có 27/10).
- CHỜ QUYẾT ĐỊNH NGƯỜI DÙNG: dashboard đọc DB bằng cách nào (xem tin nhắn cuối phiên).

## Phiên tiếp (clone lại repo trên môi trường cloud): hàm tổng hợp trong DB
- Thêm migration `20261028160000_create_reporting_functions.sql`: RPC `public.report_daily(workspace, from, to)` (security definer, chỉ admin/marketing hoặc service_role). Gộp riêng từng nguồn theo ngày VN rồi mới nối (spend không bị nhân): chi tiêu/impressions/clicks (campaign, profile active, connection active), đơn + Total Sale (fact included, contract_version mới nhất, theo recognition_date), hội thoại / có SĐT / qualified (thẻ XTS, RLCD, "XTS + RLCD" đang active + có SĐT; loại hội thoại excluded). Không trả SĐT hay nội dung khách.
- Test mới trong `tests/db/migrations.test.ts` (PGlite): tổng spend 2 chiến dịch, ranh giới ngày VN (00:30 VN = 17:30 UTC hôm trước), qualified, chặn người ngoài workspace. Bỏ qua migration `schedule_sync` trong harness vì cần pg_cron/pg_net/vault.
- Sửa `tsconfig.json`/`eslint.config.mjs` loại 2 Edge Function Deno khỏi typecheck/lint Next (trước đó typecheck và lint đỏ); Deno check vẫn phải chạy riêng (chưa chạy: máy này chưa có deno).
- Kết quả: vitest 17/17 đạt, typecheck, lint, build đạt.
- CHƯA áp migration lên project Supabase `btbsmfaakcorhluvkytx` (tác động DB thật, chờ người dùng đồng ý). Chưa đối soát `report_daily` với số 27/10 trên DB thật (kỳ vọng: 112 hội thoại, 16 đơn, 50.479.985).
- Giới hạn: DB mới đồng bộ campaign-level cho Meta và đơn chỉ có `source_ad_id` (chưa có ad entity), nên CIR theo chiến dịch/đơn từ DB chưa làm được; cần sync Meta cấp ad + bảng ad→campaign. Dashboard `/bao-cao` vẫn đọc ảnh chụp tĩnh; chờ quyết định cách đọc DB (đề xuất: Server Component gọi RPC bằng service-role phía server cho tới khi có Auth/B3).

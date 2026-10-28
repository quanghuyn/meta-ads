# Checklist triển khai dành cho Claude Code

Đọc plan.md và specs trước. Các task dưới đây nằm trong 5 giai đoạn hiện có, không phải một lịch triển khai khác. Status mặc định TODO; cập nhật bằng Markdown sau mỗi nhóm hoàn tất. Có thể dùng task IDs trong báo cáo/tài liệu, không đưa chúng vào tên test, migration hoặc comment code.

| Task | Việc cần làm và tệp chính | Phụ thuộc | Bằng chứng hoàn tất |
|---|---|---|---|
| A1 | Khảo sát repo/AGENTS/CLAUDE/docs; ghi docs/decisions.md và version matrix | Không | Không ghi đè app có sẵn; dependency choice rõ |
| A2 | Lập docs/source-access.md, docs/data-contracts.md; kiểm tra 2 Meta/1Inbox/1POS bằng read-only | A1 + quyền nguồn | Field map/pagination/permissions/updated filters được chứng minh |
| A3 | Chốt Total Sale contract và cấu hình qualification draft qua mẫu thật | A2 + quyết định nghiệp vụ | 30–50 ca, report snapshot, giới hạn attribution được ghi |
| B1 | Scaffold Next/TS/Tailwind/shadcn/Recharts, npm scripts/CI skeleton | A1 | dev/typecheck/build hoạt động; không demo-data fallback |
| B2 | Migrations scope/source/domain/jobs theo specs02, generate types | B1; vendor-independent schema có thể làm trước A2 | Local reset+schema constraints tests đạt |
| B3 | Auth invite/login/logout, SSR session, RLS và roles | B2 | Anonymous/wrong workspace/role tests đạt |
| B4 | App shell/nav/filter URL và empty/error states | B1,B3 | Mobile/login routing hoạt động |
| C1 | Domain money/date/filter validation và metric functions | B1 | Ratio-weighting/zero/date tests đạt |
| C2 | Versioned rule engine, evidence priority/temporal guards/review audit | B2,C1; active rule cần A3 | Truth table/evidence after purchase/version tests đạt |
| C3 | Durable jobs/lease/fencing/retry/checkpoint transaction | B2 | Crash/replay/parallel claim tests đạt |
| C4 | Meta adapter entities/ad-day/query profiles | A2,C3 | Spend/impressions/clicks đối chiếu nguồn; không duplicate profile |
| C5 | Inbox adapter conversations/evidence/referral | A2,C3 | Không nhầm created/updated; first-observed quality rõ |
| C6 | POS adapter orders/facts/snapshots/reconcile old orders | A2,A3,C3 | Total Sale đúng source report; return không đếm2lần |
| C7 | Identity matching + order attribution + conversation lead-origin attribution | C5,C6,A3 | Ambiguous/unattributed được giữ; một attribution active/đơn và một active/conversation |
| C8 | Webhook verification/dedup và Cron polling | C3–C6 + xác minh vendor | Replay/out-of-order tests; preview không đổi prod |
| C9 | Reporting RPC/SQL và aggregate-before-join | C1,C2,C4–C7 | Money/count/ratio khớp; RLS preserved |
| D1 | API contracts/DTO/error handling theo specs05 | B3,C9 | Validation/scope/version tests và API test đạt |
| D2 | Overview 6 KPI và 4 chart theo ảnh | B4,D1 | Chart/table same totals; states rõ |
| D3 | Ads table/drilldown/CSV | D1,D2 | Filters/sort/cursor/export đúng quyền và công thức |
| D4 | Conversation/order details, review queue và evidence | C2,C7,D1 | Sales assignment/private evidence/override audit đạt |
| D5 | Settings/rule draft activation, sync monitor/retry | C3,D1 | Không activate cấu hình thiếu; không lộ secret |
| E1 | Unit → integration/RLS → E2E/CI, Deno checks | B–D | Kết quả thực tế được ghi, không skipped silently |
| E2 | UAT + đối soát source 7–14 ngày và pilot30–50 | E1,A3 | Từng sai lệch giải thích/sửa; scope limitations rõ |
| E3 | Deploy staging rồi production theo quyền, backup/recovery/runbook | E2 | Smoke/live batch/reconciliation và bàn giao đạt |

## Dependency và blocked handling

Không có token: đánh dấu A2/A3/C4–C8/E2 nguồn tương ứng blocked; tiếp tục B1–B4/C1–C3 và UI dùng empty states/DTO contract. Không tự bỏ qua kiểm chứng để tuyên bố completed. Ánh xạ thẻ sale chưa xác nhận: viết rule engine và form, tầng chất lượng vẫn draft. Không xác định Total Sale field: giữ spend metrics dùng được, revenue metrics unavailable.

Mỗi report tại reports/ ghi: task đã làm; files; test command và actual result; dữ liệu nguồn đã/ chưa xác minh; blockers chính xác; bước kế tiếp. Không hỏi người dùng về lựa chọn code thông thường có thể tự quyết định, chỉ hỏi dữ liệu nghiệp vụ hoặc quyền thực sự thiếu.

## Thứ tự commit đề xuất

1. chore: scaffold dashboard workspace
2. feat(auth): add workspace access controls
3. feat(data): add normalized reporting schema
4. feat(sync): add resumable source synchronization
5. feat(qualification): evaluate versioned lead rules
6. feat(attribution): link orders to verified ad touches
7. feat(dashboard): add performance and quality reports
8. test: verify reporting and source reconciliation
9. docs: document deployment and recovery

Đây là gợi ý scope, không buộc commit khi chưa được user cho phép hoặc repo có convention khác. Không commit secrets/PII, không tự push/deploy khi user chỉ yêu cầu local implementation.

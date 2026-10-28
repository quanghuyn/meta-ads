# Database, migrations và quyền truy cập

Đây là schema nội bộ cần Claude chuyển thành SQL migrations. Tên trường vendor sẽ được map sau khi đọc payload thật; không giả định vendor có trường giống schema này.

## Quy ước chung

- Chuẩn hóa một tên `workspace_id` ở mọi bảng; từ organization/tenant trong bản mô tả cũ chỉ là khái niệm tương đương.
- PK nội bộ uuid, nguồn ID lưu text để tránh vượt độ chính xác JavaScript; timestamps timestamptz UTC; ngày nguồn date và timezone nguồn lưu riêng.
- Money numeric(20,4) + currency text; qua JSON là decimal string. Không ép số âm thành 0 nếu Total Sale nguồn cho phép adjustment âm.
- Mọi bảng nghiệp vụ có workspace_id, created_at, updated_at khi mutable. Với FK liên workspace, dùng composite FK (workspace_id, entity_id) → UNIQUE(workspace_id,id), không chỉ FK id và hy vọng code tự kiểm tra.
- Raw/customer private tables đặt schema không expose trực tiếp hoặc khóa quyền SELECT; chỉ RPC/server có quyền trả field phù hợp.
- Không hard-delete đơn nghiệp vụ khi vendor xóa; ghi source_deleted_at và áp dụng đúng Total Sale contract.

## Bảng và ràng buộc

| Bảng | Trường chính ngoài ID/timestamps | Khóa/ràng buộc |
|---|---|---|
| workspaces | name, business_timezone, currency | MVP một workspace; không public create |
| memberships | workspace_id, user_id FK auth.users, role admin/marketing/sales, active | UNIQUE(workspace_id,user_id) |
| source_connections | workspace_id, provider meta/inbox/pos, source_id, credential_ref, state, last_success_at, source_timezone, currency | UNIQUE(workspace_id,provider,source_id); credential_ref là tên secret cho phép, không chứa token |
| ad_entities | workspace_id, connection_id, kind account/campaign/adset/ad, source_id, parent_id nullable, name, source_status | UNIQUE(workspace_id,connection_id,kind,source_id); parent cùng connection và đúng kind; validate khi ingest |
| ad_query_profiles | workspace_id, connection_id, profile_hash, definition jsonb, active | UNIQUE(workspace_id,connection_id,profile_hash); partial unique(workspace_id,connection_id) WHERE active; chỉ active profile vào reporting |
| ad_insights_daily | workspace_id, connection_id, ad_entity_id, source_date, query_profile_hash, spend, impressions, clicks_all, clicks_link nullable, messaging_actions nullable, source_timezone, currency, synced_at | UNIQUE(workspace_id,connection_id,ad_entity_id,source_date,query_profile_hash); nonnegative counts; không dùng null thành zero |
| conversations | workspace_id, connection_id, source_id, source_customer_id nullable, first_inbound_at nullable, first_observed_at, source_updated_at, assigned_user_id nullable, eligibility eligible/excluded/unknown, exclusion_reason, history_quality complete/snapshot/partial, revision bigint | UNIQUE(workspace_id,connection_id,source_id); connection là page; revision tăng atomically khi review/evidence/result thay đổi, không nhận từ vendor |
| conversation_evidence | workspace_id, conversation_id, kind need/phone/region/exclusion/referral, source_record_id, value jsonb, evidence_at nullable, observed_at, origin source/manual, validity known/unknown/conflict | Index(conversation_id,evidence_at); dedup theo source record/kind/content hash; chứa PII trong private schema |
| rule_versions | workspace_id, version, state draft/active/retired, definition jsonb, effective_at, confirmed_by, confirmed_at | UNIQUE(workspace_id,version); tối đa một active; bản active immutable |
| qualification_results | workspace_id, conversation_id, rule_version_id, status qualified/unqualified/pending/excluded, predicate_results jsonb, evidence_cutoff_at, effective_at nullable, evaluated_at, evaluation_hash, override_by nullable, override_reason nullable | Append-only; UNIQUE(workspace_id,conversation_id,evaluation_hash); override phải có actor/reason; effective_at chỉ từ bằng chứng thời gian đáng tin |
| qualification_result_evidence | workspace_id, conversation_id, result_id, evidence_id | PK(result_id,evidence_id); composite FK gồm workspace_id/conversation_id tới cả result và evidence để chống liên kết sai |
| ad_touches | workspace_id, conversation_id, ad_entity_id nullable, source_ad_id text, touched_at nullable, observed_at, evidence_id, source_event_key | UNIQUE(workspace_id,source_event_key); null touched_at không đủ để attribution theo cửa sổ |
| customer_identity_links | workspace_id, inbox_connection_id, inbox_customer_id, pos_connection_id, pos_customer_id, method, evidence_id nullable, verified_at, reviewed_by nullable, status proposed/accepted/ambiguous/retired | Chỉ accepted dùng matching; partial unique(workspace_id,inbox_connection_id,inbox_customer_id,pos_connection_id) WHERE status=accepted; nhiều ứng viên thì ambiguous, không ghi đè mapping accepted âm thầm |
| orders | workspace_id, connection_id, source_id, source_customer_id nullable, source_conversation_id nullable, order_created_at, source_updated_at, source_status, source_deleted_at nullable, assigned_user_id nullable, currency, amount_components jsonb | UNIQUE(workspace_id,connection_id,source_id); connection là shop |
| order_total_sale_facts | workspace_id, order_id, contract_version, source_fact_key, recognition_date, included, amount, currency, reason | UNIQUE(workspace_id,order_id,contract_version,source_fact_key); cho phép nhiều dòng adjustment khi report nguồn dùng event recognition |
| shop_sale_snapshots | workspace_id, connection_id, contract_version, period_start, period_end, filter_hash, amount, currency, order_count nullable, observed_at | UNIQUE(workspace_id,connection_id,contract_version,period_start,period_end,filter_hash); total từ source report cho đúng kỳ/filter, không cộng snapshot chồng lấn hoặc cộng với order facts |
| order_attributions | workspace_id, order_id, conversation_id nullable, ad_touch_id nullable, bucket paid/organic/other/unattributed, method, reason, attribution_version, active, decided_at | Partial unique(workspace_id,order_id) WHERE active; paid cần touch và conversation hợp lệ |
| conversation_attributions | workspace_id, conversation_id, ad_touch_id nullable, bucket paid/organic/other/unattributed, method, reason, attribution_version, active, decided_at | Partial unique(workspace_id,conversation_id) WHERE active; gán nguồn lead một lần theo policy, độc lập order attribution; không nhân một lead qua nhiều Ads |
| report_settings | workspace_id, version, state draft/active/retired, total_sale_contract jsonb, attribution_policy jsonb, conversion_policy jsonb, cir_thresholds jsonb, retention_policy jsonb, confirmed_at | UNIQUE(workspace_id,version); tối đa một active; immutable khi active; contract_version facts/snapshots tham chiếu version cùng workspace |
| sync_jobs | workspace_id, connection_id, job_type, payload jsonb, dedupe_key, status queued/running/retry/succeeded/failed, cursor jsonb, attempts, available_at, lease_owner, lease_until, fencing_token, last_error_code | Active unique dedupe key; index(status,available_at); payload không token |
| sync_checkpoints | workspace_id, connection_id, stream, cursor jsonb, completed_through nullable, revision | UNIQUE(workspace_id,connection_id,stream); update sau transaction batch |
| webhook_events | workspace_id, connection_id, source_event_key, payload_private_ref, received_at, verified, status, expires_at | UNIQUE(workspace_id,connection_id,source_event_key); unverified không dùng làm bằng chứng doanh thu |
| audit_events | workspace_id, actor_id nullable, action, target_type, target_id, before_safe jsonb, after_safe jsonb, occurred_at | Append-only; không PII/token trong bản safe |

Không cần bảng order_items nếu Total Sale contract không cần chi tiết dòng; thêm khi payload hoặc yêu cầu đối soát chứng minh cần. Rollups bắt đầu bằng SQL views/RPC được index; chỉ materialize khi truy vấn thật chậm.

## Total Sale contract

`report_settings.total_sale_contract` chứa name của báo cáo POS, version, source date field/logic, timezone, status inclusion, amount mapping, ship/discount/tax/return behavior, source evidence và verified_at. Trước verified_at, doanh thu/ROAS/CIR/CPA phụ thuộc tập đơn trả unavailable với reason `total_sale_contract_unverified`; spend/CTR/CPM vẫn dùng được.

Nếu báo cáo nguồn recognition theo ngày tạo đơn, các fact dùng ngày đó và cập nhật số tiền khi trạng thái thay đổi. Nếu nguồn ghi hoàn vào ngày hoàn thì tạo fact adjustment tương ứng và không trừ lần nữa từ fact gốc. Việc chọn một trong hai phải dựa vào report thật. Order count luôn COUNT DISTINCT trên tập đơn được định nghĩa, không COUNT fact rows.

Shop snapshot chỉ là nguồn tổng dự phòng và đối soát: dùng khi period/filter/contract khớp chính xác request; không nội suy hoặc cộng các kỳ chồng lấn. Response ghi source_basis=shop_report_snapshot thay vì order_facts; không tính attributed revenue/CPA từ snapshot không có order-level mapping. Source có daily disjoint snapshots đã kiểm chứng thì mới được cộng ngày. Nếu không có exact snapshot thì unavailable và enqueue sync có quyền; không cộng cùng order facts để tăng Total Sale.

Stats phải có FK scoped đến ad_query_profiles theo profile_hash. Khi đổi profile: nhập đủ kỳ cần dùng, kiểm chứng, activate trong transaction; không kết hợp profile cũ/mới trong cùng tổng mà không có contract tương thích được duyệt.

## Migration sequence

1. `create-workspace-memberships`: scope/Auth helpers.
2. `create-source-and-ad-data`: connections, ad entities/daily stats.
3. `create-conversation-qualification-data`: conversations, evidence, rules/results, touches/identity links.
4. `create-order-revenue-attribution-data`: orders, sale facts, attribution/settings.
5. `create-sync-and-audit-data`: jobs/checkpoints/webhooks/audit.
6. `enforce-access-policies`: grants/RLS/helpers/RPC access; migrations trên production phải không để khoảng thời gian bảng expose mà chưa có RLS (tạo bảng và khóa quyền ngay từ migration đầu).
7. `create-reporting-functions`: aggregate RPC, filter validation, index.

Tên migration theo timestamp convention Supabase; không đưa phase ID vào tên. `supabase db reset` chỉ dùng local/staging test rõ ràng, không production. Generated database types phải regenerate và commit khi schema đổi.

## RLS và API

Session được kiểm chứng server theo hướng dẫn Supabase SSR hiện hành; không coi cookie user_id do client gửi là identity. Mọi API xác định membership hiện hành. Row scope là workspace + role; sales thêm assigned_user_id = auth.uid().

RLS chỉ hạn chế hàng, không tự che cột. Vì vậy private evidence/phone/connection secrets không được trả trực tiếp cho marketing bằng table SELECT. Dùng DTO/view/RPC được cấp đúng quyền; views cần giữ RLS ngữ nghĩa của caller hoặc truy vấn qua RPC có kiểm tra quyền rõ.

SECURITY DEFINER functions chỉ dùng nơi cần, fixed search_path, schema-qualified identifiers, revoke execute mặc định, kiểm tra auth.uid/membership bên trong. Hàm claim jobs/upsert được cấp service role riêng, không cho authenticated gọi trực tiếp. Worker service role bypass RLS nên phải kiểm tra connection/entity thuộc workspace trước mọi thao tác.

Nguồn tham khảo: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [SSR client](https://supabase.com/docs/guides/auth/server-side/nextjs). Không sao đoạn auth cũ nếu API SDK đã đổi.

## Index và retention

Index theo truy vấn: ad stats(workspace_id,source_date,ad_entity_id); conversations(workspace_id,first_inbound_at); orders(workspace_id,order_created_at), orders(connection_id,source_updated_at); sale facts(workspace_id,contract_version,recognition_date); qualification(conversation_id,rule_version_id,evaluated_at desc); touches(conversation_id,touched_at desc); audit(workspace_id,occurred_at desc).

Retention là cấu hình cần xác nhận trước lưu nội dung khách; ưu tiên evidence tối thiểu. Xóa raw theo expires_at bằng job có audit; giữ facts tổng hợp và dấu vết đã khử PII theo chính sách được chốt. Backup/restore phải thử ở staging.

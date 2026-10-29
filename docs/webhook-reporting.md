# Webhook reporting: local implementation and operational contract

## Scope
`20261029060000_webhook_reporting.sql` adds isolated webhook facts and an authenticated aggregate-safe report RPC. Existing `ad_insights_daily`, `report_daily` and `report_campaign_daily` remain unchanged. `/bao-cao` reads only the new webhook RPC for Meta: it never adds webhook spend to sync-meta spend. POS/Pancake-derived figures are unavailable in this screen until independently integrated/reconciled.

## Accepted contract (fail closed)
- Envelope: JSON object; `schema_version` = `1` or `"1"`; nonempty `delivery_id` (max 200 chars); `generated_at` ISO timestamp with timezone, no more than five minutes in the future; `level` = campaign/adset/ad; nonempty `rows` array, max 10,000.
- `_test` absent or JSON `false` only, both envelope and row. Any other value excludes the entire receipt.
- Account must be explicit `row.account_id` or envelope `account_id`. Both present must agree after normalization. Never infer from campaign name, level, receipt, or NK1.
- Entity key: campaign_id, adset_id, or ad_id according to envelope level. Optional row `level` must agree. IDs are digit-only after stripping leading spreadsheet quote and surrounding spaces.
- Each row must prove a daily interval: `date_start` and `date_stop` are equal valid ISO dates. Missing date_stop and multi-day aggregate rows reject; `range` is retained as raw metadata, not guessed or prorated. Verify real sender version/shape against this contract before enabling routes. A range aggregate needs a separate range-report contract, not assignment of total spend to date_start.
- Mapped optional metrics: spend, impressions, clicks, messaging_actions. Missing/JSON null/blank metrics stay SQL null; zero stays zero. Decimal comma is decimal, never thousands grouping; negative, grouped, scientific, fractional counts and invalid numbers reject. Other fields stay in raw_row/inbox, not guessed.
- Source timezone/currency come from verified connection configuration; absent values display “chưa xác minh”. NK3 timezone must not be filled by assuming NK2.

## Provision and replay (service-role/operator only)
After owner-authorized migration deployment, provision routes referencing the exact existing workspace/connection IDs, with `report_level='campaign'` (or another explicitly chosen single level), `enabled=true`. The associated Meta connection must be active. Intended accounts are NK2 `1492352028605038` and NK3 `1114645597047575`; do not enable NK1. There are no automatic account/workspace seeds. If the same account is enabled in multiple workspaces, normalization rejects as ambiguous rather than choosing one.

New inserts normalize via a DB trigger; the already deployed receiver does not need redeployment for this. Its current HTTP response still says pending_mapping/report_updated=false; DB receipt status/mapping_code is authoritative. Existing receipts are NOT automatically replayed by migration. Call `process_meta_webhook(receipt_uuid)` using service_role in bounded batches after reviewing the mapping; each receipt is atomic. Rejected receipts retain raw payload. Reprocessing rejected receipts after configuration changes is safe. Do not grant this processor to authenticated/anon.

## Snapshot and idempotency semantics
Unique fact key = connection, level, entity, source_date. Newer generated_at replaces the entire metric tuple, including nulls; older snapshots cannot overwrite it. Same delivery ID + identical JSON is duplicate; conflicting JSON rejects. Equal timestamp + changed row rejects (no arbitrary last writer). Separate delivery locks serialize replay. Concurrent different delivery IDs cannot overwrite a newer fact due to conditional upsert. Missing entities do not imply deletion/zero: sender completeness is not proven. UI calls totals “received” and explicitly warns about coverage.

One configured report_level per account prevents parent/child double counting. Reports always show one selected account; no cross-currency/account sum. Disabled connections/routes immediately disappear. No joins to orders/conversations multiply spend. Raw tables have RLS and no anon/authenticated privileges; only the checked RPC returns normalized non-PII fields. RPC rechecks active admin/marketing membership every call.

## Authentication and UI
Only URL + anon key are used in Next server code; no service-role key. Supabase Auth password sign-in at `/dang-nhap`, server actions write cookies, Next 16 `src/proxy.ts` refreshes them. Report derives workspace from authenticated memberships, not client input. Zero workspaces => forbidden; multiple => explicit unsupported selection, no tenant mixing. GET filters support valid dates, bounded range and account. Cache Components pages use Suspense; report reads remain uncached; proxy returns private/no-store. Configure Supabase Auth users/memberships through trusted administration. No automatic user creation.

## Verification boundaries
Synthetic PGlite runs the migrations and exercises roles/RLS/RPC/normalization. It is not a live Supabase/PostgREST or browser acceptance test. Auth cookie refresh and production webhook role behavior still require parent verification after deployment. Deno workers are excluded from Next tsc and require separate Deno checks. No real payload fixtures, credentials, cloud deployments, pushes or ad modifications belong to this local implementation.

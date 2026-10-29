# DB to report integration

## Scope and milestones
- Read CLAUDE.md, decisions/data contracts, plan/spec/checklist, migrations, receiver/sync workers, tests and current static bao-cao dashboard.
- Installed locked dependencies locally (`npm ci --no-audit --no-fund`, 439 packages). Read installed Next 16 docs: cookies, proxy, server components, page searchParams; Supabase SSR installed declarations.
- Implemented isolated webhook facts + explicit workspace/account routes, atomic normalization trigger/processor, authenticated report RPC. No union with sync-meta facts. Raw inbox and raw row retained.
- Replaced /bao-cao static dashboard entrypoint with server-authenticated DB report, per-account/date selection, null/empty/unavailable states. Added team login/logout and cookie refresh proxy. Old static modules remain unreferenced by route for historical tests only.

## Verification completed locally
- `npm test`: PASS, 7 files / 25 tests, 0 skipped (final run 16:50, 8.53 s). New synthetic PGlite tests exercise quoted IDs/dates, comma decimals, raw/null preservation, replay conflicts, stale/new snapshots, tests exclusion, invalid versions/accounts/daily granularity/numbers, atomic rejection, account/level separation, private raw tables and outsider/sales/anon rejection. Existing migrations/report RPC tests still pass.
- `npm run typecheck`: PASS (`next typegen && tsc --noEmit`). Next tsc excludes Deno functions; workers unchanged.
- `npm run lint`: PASS, no errors or warnings.
- `NEXT_TELEMETRY_DISABLED=1 npm run build`: PASS Next 16.4.3, /bao-cao and /dang-nhap partial prerender with runtime Suspense data; proxy compiled. Non-blocking warning: ignored unrelated C:/Users/Admin/package-lock.json outside Git repository. Vitest gives non-blocking future native-config-loader warning.
- Initial test stub lacked service_role BYPASSRLS; fixed the synthetic Supabase role stub (production Supabase already supplies this). Initial JSX-in-try lint and force-dynamic/Cache Components conflict fixed using data-only loader and Suspense per installed Next docs; final checks all pass.
- Explicit PostgREST range pagination + exact count rejects truncated/unknown-count results rather than displaying partial totals. Invalid account filters fail explicitly rather than falling back to another account.
- Deno executable unavailable; no Deno check run. Workers unchanged. No Playwright/browser E2E run (task forbids browser). No live Supabase/PostgREST/auth-cookie test, cloud changes or real data access.

## Deliberate safety constraints / deployment handoff
- Operator must provision explicit meta_webhook_routes for existing active source_connections; no default workspace/account. NK2 1492352028605038 and NK3 1114645597047575 are separate connections. Do not enable NK1 unless owner changes scope.
- Envelope schema_version accepts 1 / "1" only. Every row requires account_id (or explicit envelope account_id), level-specific numeric ID and date_start. With the additive observed-shape migration, date_stop may be absent only with row date and single-day envelope range both matching date_start. A present stop must match, and optional row date must agree. Multi-day aggregate rows or unproven daily granularity reject; raw staging remains preserved.
- Latest per entity/day, not inferred complete account snapshot. Missing entities not deleted or zeroed; UI labels received-row coverage. This is not certified full-account totals.
- POS/Pancake/CIR are explicitly unavailable on the new screen, not replaced with static values or zeros.
- Receiver's existing 202 response still says pending_mapping/report_updated=false even when DB trigger processes; receipt DB status is authoritative. No receiver cloud redeploy performed.
- Existing pending receipts require service-role process_meta_webhook(id) after routes enabled. No automatic production replay in migration.

## Observed export compatibility follow-up (local only)
- Added additive migration 20261029070000: missing date_stop requires matching row date/date_start and single-day envelope range with ISO calendar validation. Present stop and row date must agree. JSON null stop still rejects.
- Actual actions_onsite_conversion_messaging_conversation_started_7d now maps to messaging_actions; both aliases must agree after normalization, including null. Other observed reach/frequency/order/cost fields remain preserved raw-only.
- Node byte/codepoint inspection found zero U+FFFD in both UI files and docs; most shell-displayed mojibake was console decoding, not source corruption. Confirmed literal question marks in both loading fallbacks and replaced them with real UTF-8 Vietnamese. Rewrote/revalidated login labels as UTF-8; existing labels were already correct. Added synthetic observed-shape, date/range, alias/null regressions.
- Final follow-up checks: npm test PASS 7 files / 28 tests (11.49 s); npm run typecheck PASS; npm run lint PASS; NEXT_TELEMETRY_DISABLED=1 npm run build PASS (all routes + proxy). git diff --check PASS. Synthetic webhook tests now use invented account IDs only. Initial test assertion selected the empty second account, fixed to select explicit synthetic account; type declaration and temporary helper lint failures fixed before final checks.
- Node UTF-8 byte roundtrip and U+FFFD scan PASS for report/login pages and reporting docs. No deploy/replay/browser/production changes. Same nonblocking Next external lockfile and Vite native-loader warnings as baseline.

STATUS: IN PROGRESS

## Parent live verification 2026-10-29
- Parent reran all 28 tests successfully after 41129be.
- Applied exact tested 060000 + 070000 SQL transaction through signed-in Dashboard.
- Enabled separate campaign report routes for NK2/NK3 existing IDs. Owner additionally approved 3275227329354665 as a separate source (same name, different ID); timezone/currency intentionally unknown for this new source.
- Reprocessed 60 actual receipts successfully after route provisioning; test/probe receipts excluded.
- Latest source vs normalized spend matched with difference 0 for all 3 accounts x 3 levels. NK2 campaign spend 10889843, old NK3 7833036, new NK3 1150831 at source snapshot 16:43 (coverage not guaranteed full account).
- Local production server http://127.0.0.1:3005/bao-cao runs; browser correctly displays authentication_required and no data when signed out. .env.local configured with public publishable key only. No cloud UI publish/push.
- Remaining blocker: auth.users still zero for owner email; opened Create user and handoff timed out. Do not retry without asking owner. Need human set password in Supabase UI, then grant admin/marketing membership ONLY to exact owner user+workspace, then handoff login at local report and verify account/day selection.
- Pulse fd6dd5e9-fd77-47d1-8aa1-dcd20c630b4e remains active; state details .local/deployment-state.json.
STATUS: BLOCKED: human account creation and authenticated browser acceptance pending

## Owner pause
Owner explicitly selected ??? sau? for password/account creation. Do not repeat login prompts, auto-create credentials, disable auth or mark browser acceptance complete. All remaining work is blocked on that human step. Resume only when owner is ready.
STATUS: BLOCKED: owner deferred account creation

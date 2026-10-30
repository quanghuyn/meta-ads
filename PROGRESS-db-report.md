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

## Authenticated browser acceptance 2026-10-29
- Owner resumed and personally created huybo106@gmail.com through Dashboard handoff. Exact user verified; granted marketing membership only in existing workspace. No passwords collected or stored in repo/chat.
- Owner personally signed into local report. Browser displayed authenticated DB report, correct UTF-8 and account dropdown with all three distinct IDs.
- NK2 filter 2026-10-29: 14 campaign rows; spend 11373315 VND, impressions 83387, clicks 2865, snapshot 17:13:24 VN.
- New NK3 3275227329354665 filter: 2 campaign rows; spend 1201957 (currency intentionally unverified), impressions 7609, clicks346. No account mixing.
- Signed-out page was previously verified authentication_required with no data. Full auth/logout/session-expiry audit not claimed.
- Current working URL http://127.0.0.1:3005/bao-cao . UI remains LOCAL, not public deployed or pushed. Data changes require reload/Xem bao cao, not live push streaming. Local server ends if process/app stops; restart with npm run start -- --hostname 127.0.0.1 --port 3005.
- Meta-only scope complete. POS/Pancake/CIR and additional raw metrics integration remain future separate work; daily snapshot totals are received-row coverage, not guaranteed account completeness.
STATUS: ALL DONE: Meta webhook DB to authenticated local report accepted

## Production Vercel rollout 2026-10-30
- Owner approved production deployment to https://meta-ads-woad-five.vercel.app/bao-cao . Confirmed existing Vercel quanghuyns-projects/meta-ads linked to origin/main.
- Pushed existing tested changes through68aac5d; deployment Ready. Login failed because integration-managed env targets another DB (ruljnheakefrxjillitb), not webhook DB. No credentials were reset.
- Added production REPORT_SUPABASE_URL and REPORT_SUPABASE_PUBLISHABLE_KEY for actual webhook project. Preserved unrelated integration. Config now overrides atomically and fails closed for partial pair.
- Fix commit3ff6dce pushed and Vercel deployment Ready. Regression tests4/4; full suite32/32, typecheck, lint and diff check pass.
- Signed-out production returned authentication_required without report figures. Owner personally logged in successfully after DB config fix. Browser confirmed actual HTTPS production origin.
- NK2 selected date2026-10-30: 11 campaign rows, spend4029373 VND, impressions31721, clicks1427; source snapshot2026-10-30T02:13:20.213798Z. Account dropdown separates3IDs; old NK3 also displayed real data. No static figures used. These are received coverage, not certified complete-account totals.
- Production works independently of the local3005 server. Refresh/submit filters for new DB snapshots. POS/Pancake/CIR remain explicitly unavailable on this screen.
- docs/deployment.md documents environment priority, access, release and rollback.
STATUS: ALL DONE: production report connected and authenticated browser verified

## Owner correction: preserve original UX/UI
Owner objected to replacing the original dashboard; requested only data updates. Restored original Dashboard component layout from01b82e0, with data props/context instead of static modules. Original KPI footprint, four chart/funnel areas,13 campaign columns, filters and daily table retained. No production push of these restoration changes yet.
- Adapter maps only original NK2 and old NK3 fixed VND columns. New same-named account3275227329354665 stays separately excluded/labelled, not silently folded into NK3; currency still unverified.
- POS/Pancake fields are unavailable (em dash/N/A), not zero/static placeholders or Meta messaging metrics. Their actual connection remains unfinished.
- Full suite38 passed, lint/typecheck/build passed. Request-time connection guard fixes development prerender warning. Browser localhost3006 verified date presets, account filter, original headings/13 columns, noNaN/Infinity text. Private preview screenshot .local/restored-dashboard-preview.jpg.
- Local dev preview http://127.0.0.1:3006/bao-cao ; no production changes made for restoration. Needs owner review before deploy.
STATUS: BLOCKED: owner approval of original-layout restoration preview before production

## Current POS extension (owner approved)
Keep original UX/UI restored locally@7c4a3a2; do not deploy yet. Owner asked to add POS revenue before review. TODO-42592172.md is current checklist. Parent owns sequential edits (no workers). Verified live POS source1546758 active, sync_orders checkpoint2026-10-30T02:30:05Z. Latest included facts day30:2orders5939999VND, day29:21orders65399986. Need a secure aggregate-only POS RPC with freshness/unknown-day semantics, ad-ID attribution into original campaign rows (no proportional allocation), adapter updates+tests+preview, owner review before production. BrowserSQL B2DFC3AC8E2DB1FC92D2715F53EA4E61 captured request48816.768 may expire; only replay recorded requests, do not extract credentials. Local preview3006 sharp-cloud running. No more UI redesign.
STATUS: IN PROGRESS: POS revenue adapter and aggregate RPC

## POS integrated preview verification
- Added and applied additive authenticated aggregate RPC20261030030000_pos_dashboard. No raw customer access expanded, no orders modified.
- Live authenticated RPC: day29 21orders65399986,18ad orders55419989 +3no-ad9979997; day30 latest at10:00:05VN3orders9699998,2ad7039999 +1no-ad2659999; buckets reconcile exactly.
- Original UI binds POS shop metrics, per-campaign exact-ad attribution and unassigned buckets. Missing/POS-only Meta remains unknown rather than zero. Pancake columns remain unconnected, never substituted with Meta actions.
- Full46tests passed, typecheck/lint/diff check green; production build passed. Production-style local server3007 fast-sable running; browser authenticated, original KPI/table/chart layout observed. HIDDEN BROWSER PANEL had viewport0 and real clicks no-op: resize1280x950 fixed controls, not a UI code bug.
- Browser Hoomnay day30: shop9699998 and3orders; Hoomqua day29 shop65399986 and21orders, CIR46.00%,ROAS2.17 for observed Meta spend30084540. UI table13original columns maintained. NoNaN/Infinity rendered. Screenshot .local/meta-pos-ui-preview.jpg.
- Broader7day range intentionally shows incomplete Meta totals unknown, rather than implying absent older snapshots are0. Same-named third account still not merged into fixed VND columns.
- No production push/deploy of restore or POS changes. Need owner review before production. Pulse813de818-7b0d-47bd-baee-fa022ed8faf1 remains until reviewed.
STATUS: BLOCKED: owner review of original UI plus POS preview

## POS hourly schedule (owner requested)
- Verified live pg_cron4jobs. Changed existing sync-pos jobid1 from0,30 * * * * to0 * * * * (active). Preserved existing command; no duplicate POS job.
- Other live schedules unchanged: sync-pancake5,35; sync-meta-nk210,40; sync-meta-nk315,45.
- Saved additive migration20261030040000_schedule_sync_pos_hourly.sql. This is already applied on DB; do not run the old30minute schedule after it.
- Report still refresh-on-load/filter, not background auto-refresh. UI restore+POS remains local preview3007 and not pushed; owner has not yet approved deploy.
STATUS: BLOCKED: hourly POS configured; waiting owner direction on UI preview/deployment

## Approved production push 2026-10-30
Owner explicitly approved deploy. Pushed dda1953 including originalUI+POS+hourlyschedule commits. GitHub public commit status confirms Vercel success (Deployment has completed) at03:50:28Z, deployment5yvU1GaGSBgK4gRmUyEubUxe3kyS. Public report HTTP200 and authentication_required as expected without cookies. Browser automation transport is currently timing out after gateway restart, including fresh Vercel tab; no production authenticated visual acceptance claimed yet. Need owner confirmation or browser recovery, not another push.
STATUS: BLOCKED: deployed successfully; post-login production UI check pending browser recovery

## Owner added Pancake quality page
Owner approved a separate /chat-luong-mess page; preserve Ads dashboard UX/UI. Current TODO-42592172.md captures tasks. Need inspect actual Pancake tags/source freshness, secure aggregate-only RPC and tests, separate page using existing visual language, preview before deploy. No phone/message/health content or raw-conversation lists in page. Qualified=has_phone+current XTS/RLCD needs label; tags overlap. Do not infer response quality/message-count metrics absent data. Existing report restore+POS was deployed dda1953 Vercel success03:50:28Z, public HTTP200; authenticated production visual acceptance remains unverified due browser transport, do not falsely mark complete.
STATUS: IN PROGRESS: separate Pancake quality page

## Pancake quality local implementation ready
- Added separate /chat-luong-mess server page with date presets/range,6aggregateKPIs,currenttag counts+non-exclusive bars,dailytable,scope/freshness/definitions. Ads dashboard files untouched this task.
- New aggregateRPC migration20261030050000_pancake_quality.sql is LOCAL ONLY (NOT APPLIED LIVE). Securitydefiner checks membership, page+workspace scope, distinctcounts/current-source-tags, excludesrawcustomerfields and phone-like tag names, preserves missing-day null.
- Local contracts/unit/DB/safe-login tests pass: full53tests14files, typecheck/lint/build pass. Newroute private no-store matcher and allowlisted safe login return.
- LIVE BLOCKER: browser tools timeout; read-only CDP fallback connectedWS but context enumeration timedout too. HTTP endpoint9333 responds, not an authwall. Do not kill/restart gateway or keep retrying. Need owner reopen integrated browser, then capturefresh SQLquery, inspect live tags/freshness, apply testedRPC, preview with realdata and review before deploy.
- SQL tabB2DFC3AC8E2DB1FC92D2715F53EA4E61 may be stale; old recorded auth expired. Do not extract tokens or guess privateAPI.
- ExistingUI/POS deployeddda1953Vercelsuccess but stillpending actualproduction logged-invisualacceptance; no newpage deployment. Pulse813de818-7b0d-47bd-baee-fa022ed8faf1 tracks continuation.
STATUS: BLOCKED: human browser recovery needed for live Pancake verification/migration/preview

## Pancake live verification and preview
- Browser recovered. Applied exact tested20261030050000 RPC to actual Supabase. Source activePage196059750263125 sync11:35:04VN. Existing source tags verified (including Ko co nhu cau, Trung khach, Chot don), no invented ad-message equivalence.
- Authenticated role RPC actualdata29Oct129conversations/62phones/40qualified;30Oct47/22/14. Rawaggregate count checks match received totals. Labels current and overlapping, not mutually exclusive.
- Local production preview3008(faint-crest) authenticated browser shows same figures,29Oct48.1% phone/31%qualified,30Oct46.8%phone/29.8%qualified; tagfilter Ko co nhu cau returns8(17%) on30Oct. Datepresets work; noNaN/Infinity.
- Unauthenticated HTTP200 authentication_required; no aggregate table, private no-store; safe next route preserved. No changes to originalAdsUI files relative to deployeddda1953.
- Full53tests/typecheck/lint/build passed before live apply. Private screenshot.local/pancake-quality-preview.png. Newpage NOT pushed/deployed. Need owner review before production.
STATUS: BLOCKED: owner review/approval of Pancake quality preview before deploy

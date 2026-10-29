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
- Envelope schema_version currently accepts 1 / "1" only. Every row requires account_id (or explicit envelope account_id), level-specific numeric ID, date_start AND date_stop with identical dates. Multi-day aggregate rows or rows with no proven daily granularity reject, never assigned spend to date_start. Confirm actual envelope/row version and date_stop before enabling; raw staging remains preserved on rejection.
- Latest per entity/day, not inferred complete account snapshot. Missing entities not deleted or zeroed; UI labels received-row coverage. This is not certified full-account totals.
- POS/Pancake/CIR are explicitly unavailable on the new screen, not replaced with static values or zeros.
- Receiver's existing 202 response still says pending_mapping/report_updated=false even when DB trigger processes; receipt DB status is authoritative. No receiver cloud redeploy performed.
- Existing pending receipts require service-role process_meta_webhook(id) after routes enabled. No automatic production replay in migration.

STATUS: ALL DONE

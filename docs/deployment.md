# Deployment

## Platform: Vercel
- Existing project: `quanghuyns-projects/meta-ads`.
- Production URL: https://meta-ads-woad-five.vercel.app/bao-cao
- Git repository: https://github.com/quanghuyn/meta-ads
- Production branch: `main`. Push to that branch triggers the existing Vercel Git deployment.
- Framework: Next.js App Router. Do not create a replacement Vercel project.

## Environment variables
Production uses the dedicated pair `REPORT_SUPABASE_URL` and `REPORT_SUPABASE_PUBLISHABLE_KEY`, targeting the existing webhook DB project. These are server-only variables; the key is a public publishable key, NOT service role. The Vercel-managed integration targets another Supabase project, so its `NEXT_PUBLIC_SUPABASE_*` variables must not be used for this report. Existing integration variables were not changed. Local compatibility falls back to `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` only when neither report-specific variable exists. A partial override fails closed; never mix projects and keys. Values are not stored in this document. The server report uses the signed-in user's session and DB membership checks.

## Access
Sign in at `/dang-nhap` using Supabase Auth. An active workspace marketing/admin membership is required. The original dashboard layout is retained: date presets/range, campaign table account/search/CIR/sort filters, KPI/chart areas and daily table. Meta uses campaign-level webhook facts in the two original fixed account columns; do not merge the third same-named account. POS Total Sale/orders and exact-ad campaign attribution read the authenticated `report_pos_dashboard` aggregate RPC. Pancake metrics remain unavailable. Refresh for latest DB snapshots; received coverage is not certified completeness, and differently timed sources make ratios provisional. POS sync is hourly at minute00; other schedules are unchanged.

## Verification
Typecheck, lint, tests and build passed locally before release. Record the final production deployment ID and browser acceptance in the progress ledger. A Vercel Ready status alone does not establish authenticated data correctness.

## Rollback
In the existing Vercel project, select Rollback and review the previous successful deployment before promoting it. The previously observed deployment was `Gg5oBWyZ3mpnu28LJn4H3LvTziXU` at source commit `01b82e0` (old static report). Rolling back the UI does not roll back the Supabase additive schema or webhook ingestion. Do not undo DB migrations or delete inbox payloads as part of an interface rollback.

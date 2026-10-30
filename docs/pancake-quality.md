# Pancake campaign-quality page

Authenticated route `/chat-luong-mess`; original Ads/POS UI at `/bao-cao` stays unchanged. The page returns aggregate conversation quality, not raw customer records.

## Pancake refresh and definitions
The existing Pancake job refreshes every six hours. On this project's GMT pg_cron timezone, `5 */6 * * *` runs at 01:05, 07:05, 13:05 and 19:05 Vietnam time. The original job ID, worker command and lookback scope are preserved; POS hourly and external Meta webhook cadence are unchanged. Last successful source time is displayed, not a promise that every historical conversation was refreshed.

Date cohorts use Pancake source_inserted_at in Asia/Ho_Chi_Minh. Counts are received conversations, not verified engaged conversations or unique people. Explicitly excluded records stay out of the main denominator; unobserved days stay null. Phone uses has_phone only, without returning phone values. Qualified requires phone plus an active source tag XTS, RLCD or XTS + RLCD. Tags overlap and can change later. Duplicate/no-need/closed-tag are operational labels; Chot don is not a valid POS order/revenue. Message counts, response-time or missed-lead metrics are unavailable and must not be inferred.

## Campaign identity
Pancake TEXT ad IDs match exact Meta ad IDs from webhook metadata or existing ID references, then account/campaign IDs. Whitespace/leading quotes normalize without numeric casts. Names label rows only; current webhook campaign names are preferred. A conversation is assigned only when all distinct observed ad IDs identify one account/campaign. Same-campaign touches deduplicate; missing/conflicting/multiple-campaign evidence stays separate. Same names do not merge accounts.

## Moving Meta metrics: webhook only
The UI calls `report_pancake_campaign_webhook_quality`. It adds money and status to the same stable statement's conversation grouping. It does not call the legacy status-fallback endpoint, re-enable Meta polling or substitute historical source_status for absent webhook data. Older aggregate endpoints remain for compatibility, not as UI fallbacks.

Campaign-level webhook snapshots supply spend by exact connection/account, campaign and source_date within the selected inclusive date interval. The latest normalized fact per day is counted once, never multiplied by conversations/touches and never combined with ad/adset-level or sync-meta spend. Each row reports known/received/expected days, timestamp, source, currency and missing-source markers. An absent/null spend is not zero; explicit zero stays zero. Profile ambiguity or disabled routes fail closed for moving metrics.

Spend is received spend for campaign rows with received conversations, not a total for every campaign in an ad account or an attributed cost per conversation. Meta source dates and Pancake creation-date cohorts differ; no timezone/currency conversion is silently applied. Missing days remain visibly incomplete. Currency uses the configured source unit; unknown currency retains a labelled raw value, never guessed VND. Totals are not pooled across mixed/unverified currencies. Spend sorting requires comparable configured currency or a single account; all other column sorting remains available.

Campaign webhook raw status/effective_status is optional. Latest explicit status evidence can supply a dated reference; missing/explicitly-null status stays unknown. No legacy metadata fallback is used. Snapshot age/clock anomalies are visible; ACTIVE is not a delivery guarantee. Current status requires fresh upstream campaign metadata. This feature never changes ads.

## Filters, sorting and access
Search/account filters affect only the campaign table and subtotal; page KPIs keep their date/Page scope. Twelve headers expose ascending/descending controls where comparison is meaningful, with aria-sort/arrows. Counts/rates/money compare numerically, text uses natural Vietnamese order, missing values stay last and exact IDs break ties. Applied filters survive header sorting; date controls retain sort. A new read may independently see a newer source snapshot.

Active admin/marketing membership is checked in page and RPCs. Responses are private/no-store; no browser service-role key, raw phones, customer IDs or message bodies are emitted. Login return paths are allowlisted. Synthetic tests cover RLS, tenancy, ID ambiguity, duplicate touches, missing/zero values, spend/date/currency isolation, snapshot provenance and sorting. The suite has 84 passing tests; typecheck/lint/build pass. Independent PGlite boot workers are capped at two, retaining all tests/assertions and the default timeout. Apply additive migrations before deploying the consumer, then verify real signed-in production separately. Operational ledgers/screenshots stay local and are not public release data.

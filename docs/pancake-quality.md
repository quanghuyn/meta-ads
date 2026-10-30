# Pancake campaign-quality page

Independent authenticated route: `/chat-luong-mess`. The existing Ads/POS report at `/bao-cao` keeps its original UI. This page displays aggregate conversation quality, not raw customer records.

## Definitions
- Date cohort uses Pancake source_inserted_at in Asia/Ho_Chi_Minh. These are received conversations, not verified engaged conversations or unique people.
- Main denominator excludes conversations explicitly marked excluded. Unobserved days remain null; missing coverage is not zero traffic.
- Phone uses the source has_phone flag. No phone values are returned.
- Qualified requires a phone flag and a current active source tag XTS, RLCD or XTS + RLCD. It is not a diagnosis, appointment or valid order.
- Current source tags can overlap and change after creation. Duplicate/no-need/closed-tag columns are operational labels; Chot don is not a POS order or revenue.
- The current schema cannot prove message counts, response times, phone requests, silent-after-sale or missed warm leads. Do not invent those metrics or apply engaged-based targets.

## ID-based campaign linkage
`report_pancake_quality` provides the base scope and aggregates. `report_pancake_campaign_quality` adds grouping in the same stable statement snapshot. Pancake TEXT ad IDs join exact Meta ad IDs from webhook facts or existing ad-entity relationships, then exact account/campaign IDs. Whitespace/leading spreadsheet quotes are normalized, not numeric casts. Names only label rows; they never choose ownership. Current webhook campaign names are preferred for display.

A conversation is assigned only if all observed distinct ad IDs identify exactly one account/campaign. Repeated touches and several ads in that campaign count once. Missing, conflicting and multiple-campaign evidence stays in separate no_ad_id, unknown_ad and multi_campaign buckets. No revenue/spend-proportional allocation is used. All groups reconcile to the base conversation/phone/qualified totals. Same-named accounts remain distinct by ID.

## Status snapshots
`report_pancake_campaign_status_quality` adds read-only status metadata by exact account/campaign. It selects one latest eligible snapshot without blending fields across sources. Standard status/effective_status properties are accepted from campaign-level webhook raw rows when provided; otherwise existing campaign source_status metadata can serve as a dated reference. This does not enable or call the old Meta sync jobs.

The UI labels configured-only state explicitly, shows metadata time and warns for snapshots older than 24 hours or future-clock anomalies. Missing metadata stays unknown, even when spend or conversations exist. ACTIVE is not a guarantee of current delivery. Unknown codes are shown without inventing a meaning. A current status feed requires the upstream provider to supply fresh metadata; report metrics alone do not provide it. No ad state is changed by this feature.

## Filters and sorting
Date filters affect the page. Search/account filters apply only to the campaign table and its subtotal. All eleven headers support ascending/descending sorting with arrows and aria-sort. Counts/rates sort numerically, text uses natural Vietnamese collation, missing values stay last and exact ID keys break ties. Sorting does not change attribution or totals. Header links retain applied filters; filter forms retain the sort; date controls retain sort while preserving their existing reset behavior for table-only filters. A new server request may independently observe newly synced source data.

## Access and rollout
Active admin/marketing membership is checked in the server page and every aggregate RPC. Responses are private/no-store; no service-role key is exposed to the browser. Safe login return paths allow only the protected report routes. Anonymous/outsider/sales reads fail closed. No raw customer IDs, phones or message bodies are emitted; phone-like tag strings are suppressed.

The additive aggregate migrations must be applied before deploying the consuming page. Synthetic tests cover tenant boundaries, ID normalization/ambiguity, deduplication, missing values, rates, sorting/filter preservation and dated status semantics. The release test suite has 75 passing tests with typecheck/lint/build passing. Live operational ledgers and screenshots stay local and are not part of this public release. Deployment acceptance is verified separately on the production URL; build success alone is not authenticated UI acceptance.

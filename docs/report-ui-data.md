# Original report UI: data bindings, not redesign

Owner requirement: keep the original UX/UI from `01b82e0` (`dashboard.tsx` and `charts.tsx`). Only replace the data source underneath. Do not replace the page with a technical diagnostic table. Review the preview with the owner before publishing this correction.

## Meta
The fixed NK2/NK3 columns currently mean IDs `1492352028605038` and `1114645597047575`. Values come from the configured campaign-level webhook facts, never added to legacy sync-meta spend. Same-named ID `3275227329354665` is explicitly not merged into the original NK3 column; its currency remains unverified. Missing Meta for historical/POS-only rows is unknown, not zero. Therefore ranges with incomplete coverage can show N/A totals/ratios.

## POS
`report_pos_dashboard(workspace, from, to)` is an aggregate-only, authenticated admin/marketing RPC. It reads the existing shop `1546758` normalized facts with the existing contract version, recognition dates and inclusion rules. It does not change orders, statuses or revenue contracts and exposes no customer data. The shop figures retain the existing shop scope from the sync worker, not an invented per-account allocation.

- Shop Total Sale, order count and orders with ad_id feed the original KPI/daily table/chart positions.
- Mapping uses exact ad IDs, account IDs and campaign IDs from webhook or legacy entity relationships. Conflicting relationships remain unassigned. Same names never create joins.
- Account/campaign buckets plus no-ad and unknown-ad buckets reconcile to the shop total. Unassigned or out-of-scope accounts stay separate; no spend-proportional revenue allocation.
- A day without observed order facts returns null, not a manufactured zero. A day containing only explicitly excluded observations may return zero included orders.
- POS sync timestamp is visible in the existing source note. It is an observation timestamp, not a certified complete historical coverage interval. Partial-day or differently timed Meta/POS ratios are provisional.

## Unavailable
Pancake inbox/phone/qualified/duplicate/no-need columns keep their original places but show em dash until connected. Meta conversation-start actions are not substituted for Pancake conversations. Never populate missing fields from old hard-coded snapshots.

## Preview
Local production build preview on port 3007; development port 3006 had stale/browser transport issues after restarts. Browser viewport can be zero when panel is hidden: explicitly resize before diagnosing a no-op click. No production update until owner approval.

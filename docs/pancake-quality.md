# Pancake quality page

New independent path: `/chat-luong-mess`. Do not change the existing Ads dashboard layout to add it.

## Contract
`report_pancake_quality(workspace, from, to)` is an aggregate-only authenticated RPC, requiring active admin/marketing membership. Scope is the configured active Pancake inbox Page `196059750263125`. Date attribution uses `source_inserted_at` converted to Asia/Ho_Chi_Minh, not an unverified first-inbound timestamp.

- Main denominator: received conversations with eligibility other than excluded. This is NOT verified engaged conversations and not unique people.
- Phone: source `has_phone` flag. No actual phone values returned.
- Qualified: has_phone plus current active source tag XTS, RLCD or XTS + RLCD. Not a diagnosis, appointment or valid order.
- Unlabelled: no current nonempty active source tag. Manual tags are not substituted for source observations.
- Ad touch: at least one ad_touches row; this does not prove an account or campaign attribution.
- Excluded/unknown eligibility: explicit counts; exclusions are removed from main denominator.
- Tag counts are DISTINCT conversations per exact trimmed source label. Tags overlap, so their sum is not a population total and must not be charted as an exclusive pie/funnel.
- Phone-like tag labels (7+ contiguous digits) are suppressed. No customer IDs, phone fields or message bodies leave the RPC.

Days with no observed rows return null, not fabricated zero. A day with explicitly observed excluded-only rows can have zero eligible conversations. Missing sync/coverage does not establish no traffic. The source sync timestamp and observation timestamp are metadata, not certification of a complete historical interval. Current labels can change after creation, so daily historical aggregates can change.

## Unsupported metrics
The current schema does not supply message count, first response time, whether sales asked for a phone, silent-after-sale or missed warm-lead evidence. Do not infer those metrics or apply engaged-based targets to this received-conversation denominator. A Chot don operational tag is not a valid POS sale.

## Implementation
Server page queries membership and RPC with the signed-in user session, validates its shape/count bounds and keeps private no-store middleware. Safe login return path only allows /chat-luong-mess or /bao-cao, with a hidden field; arbitrary external return URLs fail closed.

## Rollout state
The tested migration has been applied to the actual report DB. Signed-in role checks and authenticated local production preview (port 3008) verified actual source data, current label names, date presets and tag filtering. Snapshot inspected: source synced 2026-10-30 11:35 VN; day 29 has 129 conversations / 62 with phone / 40 qualified; day 30 has 47 / 22 / 14. Full 53 tests, typecheck/lint/build passed. Unauthenticated HTTP requests return authentication_required with private no-store and no aggregate table. Ads report files were not changed by this feature. This new page is NOT yet deployed to Vercel; owner approval remains required. The existing report's production visual acceptance is still separately unverified although deployment dda1953 succeeded.

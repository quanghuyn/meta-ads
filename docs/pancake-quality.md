# Pancake quality page

Independent path: `/chat-luong-mess`. Preserve the existing Ads dashboard layout and the rest of this quality page. The owner requested replacing the tag-source section with a per-campaign quality table.

## Scope and metric contract
`report_pancake_quality(workspace, from, to)` remains the base aggregate API. Scope is active Pancake Page `196059750263125`. Date uses `source_inserted_at` in Asia/Ho_Chi_Minh, not an unverified first-inbound time. Active admin/marketing membership is required.

- Main denominator: received conversations with eligibility other than excluded. Not verified engaged conversations or unique people.
- Phone: source has_phone flag. Actual phone values are never returned.
- Qualified: has_phone plus current active source tag XTS, RLCD or XTS + RLCD. Not a diagnosis, appointment or valid order.
- Unlabelled: no current nonempty active source tag. Manual tags do not substitute for source observations.
- Ad touch: at least one ad_touches row, not proof of a particular account.
- Excluded/unknown eligibility are explicit counts. Exclusions are outside the main denominator.
- Tags can overlap and change after creation. Phone-like tag text (7+ contiguous digits) is suppressed. No customer IDs, phones or message text leave the API.
- Unobserved days return null, not fabricated zero. Sync time is freshness metadata, not complete-coverage certification.

## Pancake ad_id -> Meta campaign
`report_pancake_campaign_quality` calls the base API in one stable statement snapshot and adds campaign groups. It joins normalized TEXT ad IDs (trim/leading quote only), never names or numeric casts. Candidate relationships come from webhook ad facts and existing legacy ad->campaign/adset parents. Account/workspace boundaries and exact campaign IDs are retained. Same-named campaigns or accounts are not merged. Current webhook campaign names are preferred as display labels; names do not choose ownership.

A conversation is assigned only when every observed distinct ad ID maps unambiguously to the same account/campaign. Repeated touches and several ads in one campaign still count once. No touch, unknown/conflicting ad ownership, and multiple campaigns become separate no_ad_id, unknown_ad, multi_campaign buckets. Partial mappings stay unknown, not forced to a known candidate. This is a conservative internal linkage of received evidence, not Meta last-click or 7-day attribution.

Rows contain conversations, with_phone/% of row conversations, qualified/% of row conversations, current exact tag counts Trùng khách / Ko có nhu cầu / Chốt đơn. Tag columns overlap; Chốt đơn is not a POS order or revenue. All rows plus reserved buckets reconcile to the base conversation/phone/qualified counts. Source account IDs remain separate, including the third same-named NK3 when its ads match; no money/currency mixing occurs in this table.

Date filters affect the full page. Search/account filters affect only the campaign table and its filtered subtotal, not KPI cards. Form keys reset uncontrolled inputs after navigation to avoid stale displayed selections. The daily table and KPI layout remain unchanged.

## Privacy, access, unsupported metrics
Server-side user membership checks, aggregate-only security-definer APIs, private no-store responses and an allowlisted login return path protect both reports. No raw customer fields are shown. The schema does not support message counts, first response time, phone-request detection, silent-after-sale or missed warm leads. Do not infer them or apply engaged-based targets to the received-conversation denominator.

## Verification / rollout
Both tested aggregate migrations are applied to the actual DB. Full 60 tests, typecheck/lint and build passed. Live cohort at 13:35 VN: day30 70 = 63 assigned + 2 multiple campaigns + 5 no-ad, phone32 and qualified21 reconcile. Refresh at14:05 shows73 conversations/32phones/21qualified; the page totals still reconcile. Authenticated local preview3009 verified search, account filtering, same-name account separation and reset-to-all on date preset navigation. Trang that + NK2 yields5 conversations/4phones/4qualified (80%/80%). Ads UI files remain unchanged. This page is NOT deployed yet; owner review is required before pushing.

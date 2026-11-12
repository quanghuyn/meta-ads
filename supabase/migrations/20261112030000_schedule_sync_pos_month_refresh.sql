-- Owner request: every 3 days, re-read POS orders back to the start of the month so orders that were
-- cancelled while waiting for stock or returned later leave Total Sale. The hourly job only re-reads 2 days.
-- days=31 always reaches the first of the month; it also refreshes the tail of the previous month, which is
-- harmless because orders are upserted by source ID and their status decides inclusion.
-- pg_cron runs in GMT on this project: 20:00 UTC = 03:00 Vietnam, on UTC days 1, 4, 7, ... 31.
-- cron.schedule with an existing name updates that job, so re-running this migration does not duplicate it.
select cron.schedule('sync-pos-month', '0 20 */3 * *', $$select public.call_sync_worker('sync?job=pos&days=31')$$);

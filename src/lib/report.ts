export type SnapshotRow = {
  account_id: string;
  account_name: string | null;
  report_level: string;
  source_timezone: string | null;
  currency: string | null;
  source_date: string | null;
  entity_id: string | null;
  entity_name: string | null;
  spend: number | string | null;
  impressions: number | string | null;
  clicks: number | string | null;
  messaging_actions: number | string | null;
  generated_at: string | null;
};

// First day of the month for a YYYY-MM-DD date.
export const monthStart = (date: string) => date.slice(0, 8) + '01';

// Default range is the last 7 Vietnam days. withMonthStart widens the default start back to
// the first day of the month so a month-to-date view can be filtered client-side.
export function reportRange(from: unknown, to: unknown, today = new Date(), withMonthStart = false) {
  const end = new Date(today.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
  const week = new Date(Date.parse(end) - 6 * 86400_000).toISOString().slice(0, 10);
  const start = withMonthStart && monthStart(end) < week ? monthStart(end) : week;
  const f = from === undefined ? start : from;
  const t = to === undefined ? end : to;
  const valid = (v: unknown): v is string =>
    typeof v === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v;
  if (!valid(f) || !valid(t) || t < f || Date.parse(t) - Date.parse(f) > 366 * 86400_000) return null;
  return { from: f, to: t };
}

// Null never becomes zero. No totals across accounts/levels/currencies, no sync-source union.
export function knownTotal(rows: SnapshotRow[], key: 'spend' | 'impressions' | 'clicks') {
  if (!rows.length || rows.some((r) => r[key] === null)) return null;
  const values = rows.map((r) => Number(r[key]));
  return values.every(Number.isFinite) ? values.reduce((a, b) => a + b, 0) : null;
}

import type { DashboardDay } from './dashboard-data';

/** Same-unit, already validated spend only. NaN/null are absent, never zero. */
export function receivedSpend(values: readonly (number | null | undefined)[]) {
  if (values.some((v) => typeof v === 'number' && !Number.isNaN(v) && !Number.isFinite(v)))
    throw Error('invalid_received_spend');
  const known = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (known.some((v) => v < 0 || v > Number.MAX_SAFE_INTEGER)) throw Error('invalid_received_spend');
  const sum = known.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(sum) || sum > Number.MAX_SAFE_INTEGER) throw Error('unsafe_received_spend_total');
  const received = known.length ? sum : null;
  const expected = values.length;
  return {
    received,
    complete: expected > 0 && known.length === expected ? received : null,
    known: known.length,
    expected,
    partial: known.length < expected,
  };
}
export type ReceivedSpend = ReturnType<typeof receivedSpend>;

/** Separate provisional received-data ratios from the still-unknown full-scope ratios. */
export function financeFromReceived(spend: ReceivedSpend, sale: number, orders: number) {
  const ratio = (n: number | null, d: number | null) =>
    n !== null && d !== null && Number.isFinite(n) && Number.isFinite(d) && d > 0 ? n / d : null;
  const forSpend = (amount: number | null) => ({
    cir: ratio(amount, sale),
    roas: ratio(sale, amount),
    cpa: ratio(amount, orders),
  });
  const full = forSpend(spend.complete);
  const received = forSpend(spend.received);
  return { full, received, display: spend.partial ? received : full, provisional: spend.partial };
}

/** Original dashboard's two configured VND columns. This does not change ingestion/account scope. */
export function metaMetricCoverage(
  rows: readonly Pick<DashboardDay, 'date' | 'nk2' | 'nk3'>[],
  from: string,
  to: string,
  metric: 'spend' | 'impressions' | 'clicks' = 'spend',
) {
  const iso = (v: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  if (!iso(from) || !iso(to)) throw Error('invalid_meta_coverage_range');
  const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
  if (!Number.isInteger(days) || days < 1 || days > 367) throw Error('invalid_meta_coverage_range');
  const map = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (row.date < from || row.date > to) continue;
    if (map.has(row.date)) throw Error('duplicate_meta_coverage_day');
    map.set(row.date, row);
  }
  const nk2: (number | undefined)[] = [],
    nk3: (number | undefined)[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.parse(from) + i * 86400000).toISOString().slice(0, 10);
    nk2.push(map.get(date)?.nk2[metric]);
    nk3.push(map.get(date)?.nk3[metric]);
  }
  return { days, nk2: receivedSpend(nk2), nk3: receivedSpend(nk3), total: receivedSpend([...nk2, ...nk3]) };
}
export function metaSpendCoverage(
  rows: readonly Pick<DashboardDay, 'date' | 'nk2' | 'nk3'>[],
  from: string,
  to: string,
) {
  return metaMetricCoverage(rows, from, to, 'spend');
}

import type { SnapshotRow } from './report';

// Preserve the two fixed account columns in the owner's existing dashboard.
// Do not merge a same-named account or infer its currency/timezone.
export const DASHBOARD_ACCOUNTS = {
  nk2: '1492352028605038',
  nk3: '1114645597047575',
} as const;
export type Measures = { spend: number; impressions: number; clicks: number };
export type DashboardDay = {
  date: string; nk2: Measures; nk3: Measures;
  orders: number; sale: number; ordersAd: number; saleAd: number; inbox: number; phones: number;
};
export type DashboardCampaign = {
  date: string; id: string; name: string; account: string; accountId: string;
  spend: number; impressions: number; clicks: number; orders: number; sale: number;
};
export type DashboardData = {
  asOf: string; first: string; last: string; snapshot: string | null;
  dayRows: DashboardDay[]; campaignDaily: DashboardCampaign[];
  excludedAccounts: string[];
};
// NaN is an internal unavailable marker, supported by React Flight serialization.
// Renderers must show an em dash/N/A; never treat it as a real zero.
export const metric = (v: number | string | null) => v === null || !Number.isFinite(Number(v)) ? NaN : Number(v);
const sumKnown = (a: number[]) => a.length && a.every(Number.isFinite) ? a.reduce((s, n) => s + n, 0) : NaN;
export function dashboardData(rows: SnapshotRow[], first: string, last: string): DashboardData {
  const allowed = new Set<string>(Object.values(DASHBOARD_ACCOUNTS));
  const facts = rows.filter(r => allowed.has(r.account_id) && r.currency === 'VND' && r.report_level === 'campaign' && r.source_date && r.entity_id);
  const seen = new Set<string>();
  for (const r of facts) {
    const key = `${r.account_id}:${r.source_date}:${r.entity_id}`;
    if (seen.has(key)) throw Error('duplicate_dashboard_fact');
    seen.add(key);
  }
  const campaignDaily = facts.map(r => ({
    date: r.source_date!, id: `${r.account_id}:${r.entity_id}`, name: r.entity_name ?? r.entity_id!,
    account: r.account_id === DASHBOARD_ACCOUNTS.nk2 ? 'Nam Khoa 2' : 'Nam Khoa 3', accountId: r.account_id,
    spend: metric(r.spend), impressions: metric(r.impressions), clicks: metric(r.clicks),
    orders: NaN, sale: NaN,
  }));
  const dayRows = [...new Set(facts.map(r => r.source_date!))].sort().map(date => {
    const account = (id: string): Measures => {
      const matches = facts.filter(r => r.source_date === date && r.account_id === id);
      return { spend: sumKnown(matches.map(r => metric(r.spend))), impressions: sumKnown(matches.map(r => metric(r.impressions))), clicks: sumKnown(matches.map(r => metric(r.clicks))) };
    };
    return { date, nk2: account(DASHBOARD_ACCOUNTS.nk2), nk3: account(DASHBOARD_ACCOUNTS.nk3),
      orders: NaN, sale: NaN, ordersAd: NaN, saleAd: NaN, inbox: NaN, phones: NaN };
  });
  const snapshots = facts.map(r => r.generated_at).filter((v): v is string => Boolean(v));
  return { asOf: last, first, last, snapshot: snapshots.sort((a,b) => Date.parse(a)-Date.parse(b)).at(-1) ?? null,
    dayRows, campaignDaily, excludedAccounts: [...new Set(rows.filter(r => !allowed.has(r.account_id) || r.currency !== 'VND').map(r => r.account_id))] };
}

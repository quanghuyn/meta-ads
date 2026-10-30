import { describe, expect, it } from 'vitest';
import { dashboardData, DASHBOARD_ACCOUNTS } from '../../src/lib/dashboard-data';
import type { SnapshotRow } from '../../src/lib/report';
const row = (overrides: Partial<SnapshotRow> = {}): SnapshotRow => ({
 account_id: DASHBOARD_ACCOUNTS.nk2, account_name: 'Nam Khoa 2', report_level: 'campaign',
 source_timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', source_date: '2026-10-30',
 entity_id: '1234', entity_name: 'Sample', spend: '100', impressions: '1000', clicks: '20',
 messaging_actions: '2', generated_at: '2026-10-30T02:00:00Z', ...overrides,
});
const adapt = (r: SnapshotRow[]) => dashboardData(r, '2026-10-24', '2026-10-30');
describe('original dashboard live data adapter', () => {
 it('uses campaign facts only, with explicit original account columns', () => {
  const d=adapt([row(),row({account_id:DASHBOARD_ACCOUNTS.nk3,spend:200}),row({report_level:'ad',spend:999})]);
  expect(d.dayRows[0].nk2.spend).toBe(100);expect(d.dayRows[0].nk3.spend).toBe(200);
  expect(d.campaignDaily).toHaveLength(2);expect(d.campaignDaily[0].id).not.toBe(d.campaignDaily[1].id);
 });
 it('never substitutes static revenue, zero sales or Meta actions for Pancake inbox', () => {
  const d=adapt([row()]);
  for(const key of ['sale','orders','inbox','phones','saleAd','ordersAd'] as const) expect(d.dayRows[0][key]).toBeNaN();
  expect(d.campaignDaily[0].sale).toBeNaN();expect(d.campaignDaily[0].orders).toBeNaN();
 });
 it('does not infer zero for a missing account or null metric', () => {
  const d=adapt([row({spend:null})]);expect(d.dayRows[0].nk2.spend).toBeNaN();expect(d.dayRows[0].nk3.spend).toBeNaN();
 });
 it('keeps same-named foreign accounts and unknown currencies out of fixed VND columns', () => {
  const d=adapt([row({account_id:'9999',account_name:'Nam Khoa 3'}),row({currency:null})]);
  expect(d.dayRows).toHaveLength(0);expect(d.excludedAccounts).toContain('9999');
 });
 it('rejects duplicate facts instead of double-counting', () => expect(()=>adapt([row(),row()])).toThrow('duplicate_dashboard_fact'));
 it('empty data stays empty rather than returning the old hard-coded dates', () => {
  expect(adapt([]).dayRows).toEqual([]);expect(adapt([]).snapshot).toBeNull();
 });
});

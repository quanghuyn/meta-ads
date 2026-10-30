import { describe,expect,it } from 'vitest';
import { withPos,type PosDashboardRow } from '../../src/lib/pos-dashboard';
import { dashboardData,DASHBOARD_ACCOUNTS } from '../../src/lib/dashboard-data';
import type { SnapshotRow } from '../../src/lib/report';
const meta:SnapshotRow={account_id:DASHBOARD_ACCOUNTS.nk2,account_name:'Nam Khoa 2',report_level:'campaign',currency:'VND',source_timezone:'Asia/Ho_Chi_Minh',source_date:'2026-01-01',entity_id:'123',entity_name:'Campaign',spend:100,impressions:1000,clicks:10,messaging_actions:2,generated_at:'2026-01-01T03:00:00Z'};
const base=()=>dashboardData([meta],'2026-01-01','2026-01-03');
const shop:PosDashboardRow={day:'2026-01-01',bucket:'shop',account_id:null,campaign_id:null,campaign_name:null,orders:3,total_sale:600,orders_ad:2,sale_ad:400,pos_synced_at:'2026-01-01T02:00:00Z'};
const camp:PosDashboardRow={...shop,bucket:'campaign',account_id:DASHBOARD_ACCOUNTS.nk2,campaign_id:'123',campaign_name:'Campaign',orders:1,total_sale:100};
describe('POS joins into original dashboard',()=>{
 it('updates existing KPI inputs without replacing Meta spend or Pancake fields',()=>{
  const d=withPos(base(),[shop,camp]);expect(d.dayRows[0].sale).toBe(600);expect(d.dayRows[0].orders).toBe(3);expect(d.dayRows[0].saleAd).toBe(400);expect(d.dayRows[0].nk2.spend).toBe(100);expect(d.dayRows[0].inbox).toBeNaN();expect(d.campaignDaily[0].sale).toBe(100);
 });
 it('does not allocate unknown/no-ad revenue by spend and preserves account IDs',()=>{
  const d=withPos(base(),[shop,{...camp,account_id:'999'}, {...shop,bucket:'no_ad_id',orders:1,total_sale:200}]);
  expect(d.campaignDaily[0].sale).toBe(0);expect(d.unattributedDaily[0].unmapped.sale).toBe(100);expect(d.unattributedDaily[0].noAd.sale).toBe(200);
 });
 it('a failed RPC or null day never manufactures zero sales',()=>{
  expect(withPos(base(),null).dayRows[0].sale).toBeNaN();expect(withPos(base(),null).posAvailable).toBe(false);
  const d=withPos(base(),[{...shop,orders:null,total_sale:null}]);expect(d.dayRows[0].sale).toBeNaN();expect(d.campaignDaily[0].sale).toBeNaN();
 });
 it('sales-only dates keep unknown Meta as unknown, not zero spend',()=>{
  const d=withPos(base(),[{...shop,day:'2026-01-02'}]);expect(d.dayRows[1].sale).toBe(600);expect(d.dayRows[1].nk2.spend).toBeNaN();
 });
 it('keeps POS campaigns with no Meta snapshot rather than deleting their sales',()=>{
  const d=withPos(base(),[shop,{...camp,campaign_id:'456'}]);const c=d.campaignDaily.find(c=>c.id.endsWith(':456'))!;expect(c.sale).toBe(100);expect(c.spend).toBeNaN();
 });
});

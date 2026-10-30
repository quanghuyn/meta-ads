import{describe,it,expect}from'vitest';
import{webhookCampaignQualityData,canSortCampaignSpend,campaignSpendTotal,campaignSpendText}from'../../src/lib/campaign-webhook-quality';
function fixture(){return{spend_from:'2026-01-01',spend_to:'2026-01-02',page_id:'196059750263125',timezone:'Asia/Ho_Chi_Minh',synced_at:null,observed_at:null,definition_version:1,source_configured:true,attribution_model:'unique_all_touches_v1',metrics_model:'meta_webhook_metrics_v1',tags:[],days:[{day:'2026-01-01',conversations:1,with_phone:1,qualified:0,unlabelled:1,with_ad:1,excluded:0,unknown_eligibility:0},{day:'2026-01-02',conversations:null,with_phone:null,qualified:null,unlabelled:null,with_ad:null,excluded:null,unknown_eligibility:null}],campaigns:[{bucket:'campaign',account_id:'9101' as string|null,campaign_id:'311' as string|null,campaign_name:'Synthetic' as string|null,conversations:1,with_phone:1,qualified:0,duplicate:0,no_need:0,closed_tag:0,meta_status:null as string|null,meta_effective_status:null as string|null,meta_status_at:null as string|null,meta_status_source:null as string|null,spend_received:100 as number|null,spend_currency:'VND' as string|null,spend_days:1,spend_rows:2,spend_expected_days:2,spend_at:'2026-01-03T00:00:00Z' as string|null,spend_source:'webhook' as string|null,spend_issue:null as string|null}]};}
describe('webhook-only campaign finance',()=>{
 it('preserves known zero, null/missing and observed-day coverage',()=>{
  const a=fixture();expect(webhookCampaignQualityData(a)?.campaigns[0]).toMatchObject({spend_received:100,spend_days:1,spend_expected_days:2});a.campaigns[0].spend_received=0;expect(webhookCampaignQualityData(a)?.campaigns[0].spend_received).toBe(0);
  Object.assign(a.campaigns[0],{spend_received:null,spend_days:0,spend_rows:0,spend_at:null,spend_issue:'no_rows'});expect(webhookCampaignQualityData(a)?.campaigns[0].spend_received).toBeNull();
  Object.assign(a.campaigns[0],{spend_rows:1,spend_at:'2026-01-03T00:00:00Z',spend_issue:'missing_values'});expect(webhookCampaignQualityData(a)).not.toBeNull();
 });
 it('fails closed for bad coverage, unsafe amounts, wrong model and legacy status fallback',()=>{
  for(const n of[-1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){const a=fixture();a.campaigns[0].spend_received=n;expect(webhookCampaignQualityData(a)).toBeNull();}
  const a=fixture();a.campaigns[0].spend_expected_days=1;expect(webhookCampaignQualityData(a)).toBeNull();
  const gap=fixture();gap.days[1].day='2026-01-03';expect(webhookCampaignQualityData(gap)).toBeNull();const invalid=fixture();invalid.spend_to='2026-02-31';expect(webhookCampaignQualityData(invalid)).toBeNull();
  const b=fixture();b.campaigns[0].spend_rows=3;expect(webhookCampaignQualityData(b)).toBeNull();b.campaigns[0].spend_rows=2;b.metrics_model='legacy';expect(webhookCampaignQualityData(b)).toBeNull();
  const c=fixture();Object.assign(c.campaigns[0],{meta_status:'ACTIVE',meta_status_at:'2026-01-03T00:00:00Z',meta_status_source:'legacy_metadata'});expect(webhookCampaignQualityData(c)).toBeNull();
 });
 it('does not allocate spend to unidentified conversations',()=>{
  const a=fixture();Object.assign(a.campaigns[0],{bucket:'unknown_ad',account_id:null,campaign_id:null,campaign_name:null,spend_received:null,spend_currency:null,spend_days:0,spend_rows:0,spend_expected_days:0,spend_at:null,spend_source:null,spend_issue:'unassigned'});expect(webhookCampaignQualityData(a)).not.toBeNull();a.campaigns[0].spend_received=100;expect(webhookCampaignQualityData(a)).toBeNull();
 });
 it('never pools or ranks known amounts across mixed/unknown account currencies',()=>{
  const row=webhookCampaignQualityData(fixture())!.campaigns[0];const other={...row,account_id:'9102',campaign_id:'312',spend_received:20};expect(campaignSpendTotal([row,other]).amount).toBe(120);expect(canSortCampaignSpend([row,other])).toBe(true);
  const usd={...other,spend_currency:'USD'};expect(campaignSpendTotal([row,usd]).amount).toBeNull();expect(canSortCampaignSpend([row,usd])).toBe(false);
  const raw={...other,spend_currency:null};expect(campaignSpendTotal([row,raw]).amount).toBeNull();expect(canSortCampaignSpend([row,raw])).toBe(false);expect(canSortCampaignSpend([{...row,spend_currency:null},{...raw,account_id:row.account_id}])).toBe(true);
 });
 it('labels a received subtotal as incomplete and formats unknown units without guessing VND',()=>{
  const row=webhookCampaignQualityData(fixture())!.campaigns[0];const total=campaignSpendTotal([row]);expect(total.amount).toBe(100);expect(total.incomplete).toBe(1);expect(total.issue).toContain('thiếu độ phủ');expect(campaignSpendText(null,'VND')).toBe('—');expect(campaignSpendText(0,'VND')).toContain('0');expect(campaignSpendText(111.25,null)).toContain('chưa rõ tiền tệ');
 });
});

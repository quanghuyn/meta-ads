import{describe,it,expect}from'vitest';
import{campaignQualityData,type CampaignQuality}from'../../src/lib/pancake-campaign-quality';
const row:CampaignQuality={bucket:'campaign',account_id:'9101',campaign_id:'9007199254740993',campaign_name:'Same name',conversations:1,with_phone:1,qualified:1,duplicate:0,no_need:0,closed_tag:0};
const base=()=>({page_id:'196059750263125',timezone:'Asia/Ho_Chi_Minh',source_configured:true,synced_at:null,observed_at:null,definition_version:1,days:[{day:'2026-01-02',conversations:1,with_phone:1,qualified:1,unlabelled:0,with_ad:1,excluded:0,unknown_eligibility:0}],tags:[],campaigns:[{...row}],attribution_model:'unique_all_touches_v1'});
describe('campaign quality contract',()=>{
 it('preserves exact string IDs and distinguishes equal names across accounts',()=>{
  const b=base();b.campaigns.push({...row,account_id:'9102'});b.days[0]={...b.days[0],conversations:2,with_phone:2,qualified:2,with_ad:2};const d=campaignQualityData(b)!;expect(d.campaigns).toHaveLength(2);expect(d.campaigns[0].campaign_id).toBe('9007199254740993');
 });
 it('rejects duplicates, inconsistent totals/rates and false attribution of unassigned buckets',()=>{
  const a=base();a.campaigns.push({...row});expect(campaignQualityData(a)).toBeNull();const b=base();b.campaigns[0].qualified=2;expect(campaignQualityData(b)).toBeNull();
  const c=base();c.campaigns=[];expect(campaignQualityData(c)).toBeNull();const d={...base(),campaigns:[{...row,bucket:'unknown_ad'}]};expect(campaignQualityData(d)).toBeNull();
 });
 it('accepts explicitly unassigned multi-campaign rows without spreading them over campaigns',()=>{
  const b={...base(),campaigns:[{...row,bucket:'multi_campaign',account_id:null,campaign_id:null,campaign_name:null}]};expect(campaignQualityData(b)?.campaigns[0].bucket).toBe('multi_campaign');
 });
 it('checks no-ad totals against received ad-touch coverage',()=>{
  const b={...base(),campaigns:[{...row,bucket:'no_ad_id',account_id:null,campaign_id:null,campaign_name:null}]};expect(campaignQualityData(b)).toBeNull();b.days[0].with_ad=0;expect(campaignQualityData(b)).not.toBeNull();
 });
 it('validates status provenance and rejects assigning a Meta state to unassigned buckets',()=>{
  const a=base();a.campaigns=[{...a.campaigns[0],meta_status:'ACTIVE',meta_effective_status:null,meta_status_at:'2026-01-02T00:00:00Z',meta_status_source:'legacy_metadata'}];expect(campaignQualityData(a)?.campaigns[0].meta_status).toBe('ACTIVE');
  const partial={...base(),campaigns:[{...row,meta_status:'ACTIVE'}]};expect(campaignQualityData(partial)).toBeNull();
  const invalid={...a,campaigns:[{...a.campaigns[0],bucket:'unknown_ad',account_id:null,campaign_id:null,campaign_name:null}]};expect(campaignQualityData(invalid)).toBeNull();
 });
});

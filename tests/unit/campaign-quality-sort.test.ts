import{describe,it,expect}from'vitest';
import{campaignSort,sortCampaignQuality,nextCampaignSort,campaignSortHref,campaignColumns}from'../../src/lib/campaign-quality-sort';
import type{CampaignQuality}from'../../src/lib/pancake-campaign-quality';
const row=(patch:Partial<CampaignQuality>={}):CampaignQuality=>({bucket:'campaign',account_id:'1492352028605038',campaign_id:'9007199254740993',campaign_name:'Campaign 2',conversations:100,with_phone:80,qualified:60,duplicate:10,no_need:7,closed_tag:5,...patch});
describe('quality table column sorting',()=>{
 it('sorts each count numerically in both directions without mutating rows or totals',()=>{
  const rows=[row({campaign_id:'2'}),row({campaign_id:'3',conversations:10,with_phone:9,qualified:8,duplicate:1,no_need:1,closed_tag:1})];
  for(const key of ['conversations','with_phone','qualified','duplicate','no_need','closed_tag']as const){expect(sortCampaignQuality(rows,{key,direction:'desc'})[0].campaign_id).toBe('2');expect(sortCampaignQuality(rows,{key,direction:'asc'})[0].campaign_id).toBe('3');}
  expect(rows[0].campaign_id).toBe('2');expect(rows.reduce((s,r)=>s+r.conversations,0)).toBe(110);
 });
 it('sorts ratios as numbers rather than percentage strings and does not mix count with rate',()=>{
  const rows=[row({campaign_id:'1',conversations:100,with_phone:9,qualified:8}),row({campaign_id:'2',with_phone:80,qualified:60})];
  expect(sortCampaignQuality(rows,{key:'phone_rate',direction:'desc'})[0].campaign_id).toBe('2');expect(sortCampaignQuality(rows,{key:'qualified_rate',direction:'asc'})[0].campaign_id).toBe('1');
  const changed=[row({campaign_id:'a'}),row({campaign_id:'b',conversations:10,with_phone:9,qualified:8})];expect(sortCampaignQuality(changed,{key:'phone_rate',direction:'desc'})[0].campaign_id).toBe('b');
 });
 it('uses natural campaign/account labels, preserves exact IDs and places missing account/rate last',()=>{
  expect(sortCampaignQuality([row({campaign_name:'Campaign 10'}),row({campaign_id:'2'})],{key:'campaign',direction:'asc'})[0].campaign_name).toBe('Campaign 2');
  const noAd=row({bucket:'no_ad_id',account_id:null,campaign_id:null,campaign_name:null,conversations:0,with_phone:0,qualified:0});
  for(const direction of ['asc','desc']as const){expect(sortCampaignQuality([noAd,row()],{key:'account',direction})[1].bucket).toBe('no_ad_id');expect(sortCampaignQuality([noAd,row()],{key:'phone_rate',direction})[1].bucket).toBe('no_ad_id');}
  const ordered=sortCampaignQuality([row({account_id:'1114645597047575'}),row()],{key:'account',direction:'asc'});expect(ordered[0].account_id).toBe('1492352028605038');expect(ordered[0].campaign_id).toBe('9007199254740993');
 });
 it('keeps deterministic ties regardless of input/direction and never drops unassigned buckets',()=>{
  const a=row({campaign_id:'1'}),b=row({campaign_id:'2'});for(const direction of ['asc','desc']as const)expect(sortCampaignQuality([b,a],{key:'conversations',direction}).map(r=>r.campaign_id)).toEqual(['1','2']);
  const c=row({bucket:'unknown_ad',account_id:null,campaign_id:null,campaign_name:null});expect(sortCampaignQuality([a,c],{key:'qualified_rate',direction:'desc'})).toHaveLength(2);
 });
 it('toggles active direction, chooses sensible first direction and whitelists query values',()=>{
  expect(campaignSort({})).toEqual({key:'conversations',direction:'desc'});expect(campaignSort({sort:'bogus',direction:'evil'})).toEqual({key:'conversations',direction:'desc'});
  expect(nextCampaignSort({key:'conversations',direction:'desc'},'conversations')).toEqual({key:'conversations',direction:'asc'});expect(nextCampaignSort({key:'campaign',direction:'asc'},'phone_rate')).toEqual({key:'phone_rate',direction:'desc'});expect(campaignColumns).toHaveLength(12);
 });
 it('keeps date, account and applied search filters in safe local header links',()=>{
  const href=campaignSortHref({from:'2026-01-01',to:'2026-01-02',campaign:'A & B',account:'1492352028605038'},{key:'phone_rate',direction:'asc'});const u=new URL(href,'https://example.test/chat-luong-mess');
  expect(u.pathname).toBe('/chat-luong-mess');expect(u.searchParams.get('campaign')).toBe('A & B');expect(u.searchParams.get('account')).toBe('1492352028605038');expect(u.searchParams.get('from')).toBe('2026-01-01');expect(u.searchParams.get('to')).toBe('2026-01-02');expect(u.searchParams.get('direction')).toBe('asc');expect(u.hash).toBe('#campaign-quality');
 });
 it('sorts source status codes and keeps campaigns without status last',()=>{
  const provenance={meta_effective_status:null,meta_status_at:'2026-01-02T00:00:00Z',meta_status_source:'legacy_metadata' as const};
  const a=row({...provenance,meta_status:'ACTIVE',campaign_id:'a'}),p=row({...provenance,meta_status:'PAUSED',campaign_id:'p'}),u=row({campaign_id:'u'});
  expect(sortCampaignQuality([u,p,a],{key:'status',direction:'asc'}).map(r=>r.campaign_id)).toEqual(['a','p','u']);expect(sortCampaignQuality([u,p,a],{key:'status',direction:'desc'}).map(r=>r.campaign_id)).toEqual(['p','a','u']);
 });
 it('sorts webhook spend numerically and keeps non-webhook/missing amounts last',()=>{
  const a=row({campaign_id:'a',spend_source:'webhook',spend_received:100.5}),b=row({campaign_id:'b',spend_source:'webhook',spend_received:20.5}),u=row({campaign_id:'u',spend_received:999});
  expect(sortCampaignQuality([u,a,b],{key:'spend',direction:'asc'}).map(r=>r.campaign_id)).toEqual(['b','a','u']);expect(sortCampaignQuality([u,b,a],{key:'spend',direction:'desc'}).map(r=>r.campaign_id)).toEqual(['a','b','u']);
 });
});

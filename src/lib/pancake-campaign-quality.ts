import{qualityData,qualitySummary,type QualityData}from'./pancake-quality';
import{readCampaignMetaStatus,type CampaignMetaStatus}from'./campaign-meta-status';
import type { CampaignSpend } from './campaign-webhook-quality';
export type CampaignBucket='campaign'|'no_ad_id'|'unknown_ad'|'multi_campaign';
export type CampaignQuality={bucket:CampaignBucket;account_id:string|null;campaign_id:string|null;campaign_name:string|null;conversations:number;with_phone:number;qualified:number;duplicate:number;no_need:number;closed_tag:number}&Partial<CampaignMetaStatus>&Partial<CampaignSpend>;
export type CampaignQualityData=QualityData&{campaigns:CampaignQuality[];attribution_model:'unique_all_touches_v1'};
export const campaignBucketLabels:Record<CampaignBucket,string>={campaign:'Chiến dịch Meta',no_ad_id:'Chưa có ad_id trên Pancake',unknown_ad:'ad_id chưa xác định duy nhất trên Meta',multi_campaign:'Hội thoại có nhiều campaign'};
const metricKeys=['conversations','with_phone','qualified','duplicate','no_need','closed_tag']as const;
export function campaignQualityData(raw:unknown):CampaignQualityData|null{
 const base=qualityData(raw);if(!base||!raw||typeof raw!=='object')return null;
 const r=raw as Record<string,unknown>;
 if(r.attribution_model!=='unique_all_touches_v1'||!Array.isArray(r.campaigns)||r.campaigns.length>5000)return null;
 const rows:CampaignQuality[]=[];const keys=new Set<string>();
 for(const item of r.campaigns){
  if(!item||typeof item!=='object'||Array.isArray(item))return null;const c=item as Record<string,unknown>;
  if(typeof c.bucket!=='string'||!Object.hasOwn(campaignBucketLabels,c.bucket))return null;
  for(const key of metricKeys)if(typeof c[key]!=='number'||!Number.isSafeInteger(c[key])||(c[key] as number)<0)return null;
  if((c.conversations as number)<=0||(c.with_phone as number)>(c.conversations as number)||(c.qualified as number)>(c.with_phone as number))return null;
  for(const key of ['duplicate','no_need','closed_tag'])if((c[key] as number)>(c.conversations as number))return null;
  if(c.bucket==='campaign'){
   if(typeof c.account_id!=='string'||!/^\d+$/.test(c.account_id)||typeof c.campaign_id!=='string'||!/^\d+$/.test(c.campaign_id)||typeof c.campaign_name!=='string'||c.campaign_name.length>1000)return null;
  }else if(c.account_id!==null||c.campaign_id!==null||c.campaign_name!==null)return null;
  const key=`${c.bucket}:${c.account_id??''}:${c.campaign_id??''}`;if(keys.has(key))return null;keys.add(key);
  const meta=readCampaignMetaStatus(c);if(!meta)return null;
  if(c.bucket!=='campaign'&&(meta.meta_status||meta.meta_effective_status))return null;
  rows.push({...Object.fromEntries(['bucket','account_id','campaign_id','campaign_name',...metricKeys].map(k=>[k,c[k]])),...meta}as CampaignQuality);
 }
 const summary=qualitySummary(base);const sum=(k:typeof metricKeys[number])=>rows.reduce((s,c)=>s+c[k],0);
 if(sum('conversations')!==(summary.total??0)||sum('with_phone')!==(summary.phones??0)||sum('qualified')!==(summary.qualified??0))return null;
 const noAd=rows.filter(c=>c.bucket==='no_ad_id').reduce((s,c)=>s+c.conversations,0);
 if(noAd!==(summary.total??0)-(summary.withAd??0))return null;
 return{...base,campaigns:rows,attribution_model:'unique_all_touches_v1'};
}

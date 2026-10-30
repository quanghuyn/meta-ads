export type QualityDay={day:string;conversations:number|null;with_phone:number|null;qualified:number|null;unlabelled:number|null;with_ad:number|null;excluded:number|null;unknown_eligibility:number|null};
export type QualityData={page_id:string;timezone:string;source_configured:boolean;synced_at:string|null;observed_at:string|null;definition_version:number;days:QualityDay[];tags:{tag:string;conversations:number}[]};
export const qualityKeys=['conversations','with_phone','qualified','unlabelled','with_ad','excluded','unknown_eligibility'] as const;
const object=(v:unknown):v is Record<string,unknown>=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
const count=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
export function qualityData(v:unknown):QualityData|null{
 if(!object(v)||v.page_id!=='196059750263125'||v.timezone!=='Asia/Ho_Chi_Minh'||v.definition_version!==1||typeof v.source_configured!=='boolean'||!Array.isArray(v.days)||v.days.length>367||!Array.isArray(v.tags)||v.tags.length>5000)return null;
 for(const key of ['synced_at','observed_at'])if(v[key]!==null&&(typeof v[key]!=='string'||!Number.isFinite(Date.parse(v[key] as string))))return null;
 const seen=new Set<string>();
 const days:QualityDay[]=[];
 for(const r of v.days){
  if(!object(r)||typeof r.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.day)||!Number.isFinite(Date.parse(r.day))||new Date(r.day).toISOString().slice(0,10)!==r.day||seen.has(r.day))return null;
  seen.add(r.day);
  for(const key of qualityKeys)if(r[key]!==null&&!count(r[key]))return null;
  if(r.conversations===null&&qualityKeys.some(k=>r[k]!==null))return null;
  if(count(r.conversations)){
   if(qualityKeys.some(k=>r[k]===null))return null;
   for(const key of ['with_phone','qualified','with_ad','unlabelled','unknown_eligibility'])if((r[key] as number)>r.conversations)return null;
   if((r.qualified as number)>(r.with_phone as number))return null;
  }
  days.push({day:r.day,...Object.fromEntries(qualityKeys.map(k=>[k,r[k]]))} as QualityDay);
 }
 const received=days.reduce((s,d)=>s+(d.conversations??0),0);
 const tags:{tag:string;conversations:number}[]=[];const tagSeen=new Set<string>();
 for(const t of v.tags){if(!object(t)||typeof t.tag!=='string'||!t.tag.trim()||t.tag.length>120||/[0-9]{7,}/.test(t.tag)||!count(t.conversations)||t.conversations>received||tagSeen.has(t.tag))return null;tagSeen.add(t.tag);tags.push({tag:t.tag,conversations:t.conversations});}
 return{page_id:v.page_id,timezone:v.timezone,source_configured:v.source_configured,synced_at:v.synced_at as string|null,observed_at:v.observed_at as string|null,definition_version:1,days,tags};
}
export function qualitySummary(data:QualityData){
 const observed=data.days.filter(d=>d.conversations!==null);
 const sum=(key:typeof qualityKeys[number])=>observed.length?observed.reduce((s,d)=>s+(d[key]??0),0):null;
 const total=sum('conversations'),phones=sum('with_phone'),qualified=sum('qualified');
 const ratio=(a:number|null,b:number|null)=>a!==null&&b!==null&&b>0?a/b:null;
 return{total,phones,qualified,unlabelled:sum('unlabelled'),withAd:sum('with_ad'),excluded:sum('excluded'),unknown:sum('unknown_eligibility'),phoneRate:ratio(phones,total),qualifiedRate:ratio(qualified,total),qualifiedPhoneRate:ratio(qualified,phones),observedDays:observed.length};
}

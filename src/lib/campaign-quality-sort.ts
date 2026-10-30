import { campaignBucketLabels, type CampaignQuality } from './pancake-campaign-quality';
export const campaignColumns=[
 {key:'campaign',label:'Campaign / nhóm'}, {key:'account',label:'Tài khoản'}, {key:'status',label:'Trạng thái Meta'},
 {key:'conversations',label:'Hội thoại'}, {key:'with_phone',label:'Có SĐT'},
 {key:'phone_rate',label:'% SĐT'}, {key:'qualified',label:'Qualified'},
 {key:'qualified_rate',label:'% Qualified'}, {key:'duplicate',label:'Trùng khách'},
 {key:'no_need',label:'Ko có nhu cầu'}, {key:'closed_tag',label:'Nhãn Chốt đơn'},
] as const;
export type CampaignSortKey=typeof campaignColumns[number]['key'];
export type CampaignSort={key:CampaignSortKey;direction:'asc'|'desc'};
export const campaignAccountNames:Record<string,string>={'1492352028605038':'Nam Khoa 2','1114645597047575':'Nam Khoa 3','3275227329354665':'Nam Khoa 3'};
const collator=new Intl.Collator('vi',{numeric:true,sensitivity:'base'});
export function campaignSort(query:Record<string,unknown>):CampaignSort{
 const key=campaignColumns.find(c=>c.key===query.sort)?.key??'conversations';
 return{key,direction:query.direction==='asc'?'asc':'desc'};
}
function value(c:CampaignQuality,key:CampaignSortKey):string|number|null{
 if(key==='campaign')return c.campaign_name??campaignBucketLabels[c.bucket];
 if(key==='account')return c.account_id?(campaignAccountNames[c.account_id]??c.account_id):null;
 if(key==='status')return c.meta_status_at&&c.meta_status_source?(c.meta_effective_status??c.meta_status??null):null;
 if(key==='phone_rate')return c.conversations>0?c.with_phone/c.conversations:null;
 if(key==='qualified_rate')return c.conversations>0?c.qualified/c.conversations:null;
 return c[key];
}
function identity(c:CampaignQuality){return `${c.bucket}:${c.account_id??''}:${c.campaign_id??''}`;}
export function sortCampaignQuality(rows:readonly CampaignQuality[],sort:CampaignSort){
 return[...rows].sort((a,b)=>{
  const x=value(a,sort.key),y=value(b,sort.key);
  if(x===null&&y!==null)return 1;if(y===null&&x!==null)return -1;
  let result=0;
  if(x!==null&&y!==null)result=typeof x==='number'&&typeof y==='number'?x-y:collator.compare(String(x),String(y));
  // Stable ID tie-break is deliberately independent of direction and source row order.
  return(result*(sort.direction==='asc'?1:-1))||identity(a).localeCompare(identity(b));
 });
}
export function nextCampaignSort(current:CampaignSort,key:CampaignSortKey):CampaignSort{
 return{key,direction:current.key===key?(current.direction==='asc'?'desc':'asc'):(key==='campaign'||key==='account'||key==='status'?'asc':'desc')};
}
export function campaignSortHref(filters:{from:string;to:string;campaign:string;account:string},next:CampaignSort){
 const params=new URLSearchParams({from:filters.from,to:filters.to,campaign:filters.campaign,account:filters.account,sort:next.key,direction:next.direction});
 return`?${params.toString()}#campaign-quality`;
}

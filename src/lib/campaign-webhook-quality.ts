import { campaignQualityData, type CampaignQualityData, type CampaignQuality } from './pancake-campaign-quality';
export type CampaignSpend={spend_received:number|null;spend_currency:string|null;spend_days:number;spend_rows:number;spend_expected_days:number;spend_at:string|null;spend_source:'webhook'|null;spend_issue:'unassigned'|'source_unavailable'|'ambiguous_account'|'no_rows'|'missing_values'|null};
const issues=[null,'unassigned','source_unavailable','ambiguous_account','no_rows','missing_values'];
const integer=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
const stamp=(n:unknown):n is string=>typeof n==='string'&&Number.isFinite(Date.parse(n));
export function webhookCampaignQualityData(raw:unknown):CampaignQualityData|null{
 const base=campaignQualityData(raw);if(!base||!raw||typeof raw!=='object')return null;const body=raw as Record<string,unknown>;
 if(body.metrics_model!=='meta_webhook_metrics_v1'||!Array.isArray(body.campaigns))return null;
 const from=body.spend_from,to=body.spend_to;
 const iso=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 if(!iso(from)||!iso(to))return null;
 const expected=(Date.parse(to)-Date.parse(from))/86400000+1;
 if(!Number.isInteger(expected)||expected<1||expected>367||base.days.length!==expected||base.days.some((d,i)=>Date.parse(d.day)!==Date.parse(from)+i*86400000))return null;
 const rows:CampaignQuality[]=[];
 for(let i=0;i<base.campaigns.length;i++){
  const c=base.campaigns[i],r=body.campaigns[i]as Record<string,unknown>;
  if(c.meta_status_source==='legacy_metadata')return null;
  for(const k of ['spend_days','spend_rows','spend_expected_days'])if(!integer(r[k]))return null;
  const days=r.spend_days as number,count=r.spend_rows as number,total=r.spend_expected_days as number;
  if(days>count||count>total)return null;
  const amount=r.spend_received;if(amount!==null&&(typeof amount!=='number'||!Number.isFinite(amount)||amount<0||amount>Number.MAX_SAFE_INTEGER))return null;
  const currency=r.spend_currency;if(currency!==null&&(typeof currency!=='string'||!/^[A-Z]{3}$/.test(currency)))return null;
  if(r.spend_at!==null&&!stamp(r.spend_at))return null;
  if(r.spend_source!==null&&r.spend_source!=='webhook')return null;
  if(c.meta_status_source==='webhook_snapshot'&&r.spend_source!=='webhook')return null;
  if(!issues.includes(r.spend_issue as CampaignSpend['spend_issue']))return null;
  if(c.bucket!=='campaign'){
   if(amount!==null||currency!==null||days!==0||count!==0||total!==0||r.spend_at!==null||r.spend_source!==null||r.spend_issue!=='unassigned')return null;
  }else{
   if(total!==expected||r.spend_issue==='unassigned')return null;
   if(r.spend_source==='webhook'){
    if((count===0)!==(r.spend_at===null))return null;
    if(days>0){if(amount===null||r.spend_issue!==null)return null;}
    else if(amount!==null||r.spend_issue!==(count===0?'no_rows':'missing_values'))return null;
   }else if(!['source_unavailable','ambiguous_account'].includes(String(r.spend_issue))||amount!==null||currency!==null||days!==0||count!==0||r.spend_at!==null)return null;
  }
  rows.push({...c,...Object.fromEntries(['spend_received','spend_currency','spend_days','spend_rows','spend_expected_days','spend_at','spend_source','spend_issue'].map(k=>[k,r[k]]))}as CampaignQuality);
 }
 return{...base,campaigns:rows};
}
const numeric=(c:CampaignQuality)=>c.bucket==='campaign'&&c.spend_source==='webhook'&&typeof c.spend_received==='number'&&Number.isFinite(c.spend_received);
export function canSortCampaignSpend(rows:readonly CampaignQuality[]){
 const known=rows.filter(numeric);if(!known.length)return false;
 if(new Set(known.map(c=>c.account_id)).size===1)return true;
 return known.every(c=>typeof c.spend_currency==='string')&&new Set(known.map(c=>c.spend_currency)).size===1;
}
export function campaignSpendTotal(rows:readonly CampaignQuality[]){
 const campaigns=rows.filter(c=>c.bucket==='campaign'),known=campaigns.filter(numeric);
 const incomplete=campaigns.filter(c=>!numeric(c)||c.spend_days!==c.spend_expected_days).length;
 if(!known.length)return{amount:null,currency:null,incomplete,issue:'Chưa có chi tiêu từ webhook'};
 if(known.some(c=>!c.spend_currency)||new Set(known.map(c=>c.spend_currency)).size!==1)return{amount:null,currency:null,incomplete,issue:'Không cộng khác/chưa rõ tiền tệ'};
 const amount=known.reduce((s,c)=>s+c.spend_received!,0);
 if(!Number.isFinite(amount)||amount>Number.MAX_SAFE_INTEGER)return{amount:null,currency:null,incomplete,issue:'Tổng vượt giới hạn hiển thị an toàn'};
 return{amount,currency:known[0].spend_currency??null,incomplete,issue:incomplete?'Tổng chi tiêu đã nhận, còn thiếu độ phủ':null};
}
export function campaignSpendText(amount:number|null|undefined,currency:string|null|undefined){
 if(typeof amount!=='number'||!Number.isFinite(amount))return'—';
 const value=amount.toLocaleString('vi-VN',{maximumFractionDigits:4});return currency?`${value} ${currency==='VND'?'₫':currency}`:`${value} · chưa rõ tiền tệ`;
}
export function campaignSpendNote(c:CampaignQuality){
 if(c.bucket!=='campaign')return'Không phân bổ tiền cho nhóm chưa gán';
 if(c.spend_issue==='source_unavailable')return'Chưa cấu hình nguồn campaign webhook';
 if(c.spend_issue==='ambiguous_account')return'Nguồn tài khoản không xác định duy nhất';
 return`${c.spend_days??0}/${c.spend_expected_days??0} ngày có số${c.spend_issue==='no_rows'?' · chưa nhận snapshot':c.spend_issue==='missing_values'?' · thiếu giá trị chi tiêu':''}`;
}

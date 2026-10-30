import Link from 'next/link';
import {canSortCampaignSpend,campaignSpendTotal,campaignSpendText,campaignSpendNote} from '@/lib/campaign-webhook-quality';
import { campaignStatusView } from '@/lib/campaign-meta-status';
import { campaignBucketLabels, type CampaignQualityData } from '@/lib/pancake-campaign-quality';
import { campaignColumns, campaignSort, sortCampaignQuality, nextCampaignSort, campaignSortHref, campaignAccountNames as accounts } from '@/lib/campaign-quality-sort';
const count=(n:number)=>n.toLocaleString('vi-VN');
const percent=(a:number,b:number)=>b>0?(a/b*100).toLocaleString('vi-VN',{maximumFractionDigits:1})+'%':'N/A';
export default function CampaignTable({data,from,to,query}:{data:CampaignQualityData;from:string;to:string;query:Record<string,string|string[]|undefined>}){
 const search=typeof query.campaign==='string'?query.campaign.trim().slice(0,120):'';
 const account=typeof query.account==='string'?query.account.slice(0,64):'all';
 const accountIds=[...new Set(data.campaigns.flatMap(c=>c.account_id?[c.account_id]:[]))].sort();
 let sort=campaignSort(query);
 const filtered=data.campaigns.filter(c=>(account==='all'||(account==='unassigned'?c.bucket!=='campaign':c.account_id===account))&&`${c.campaign_name??campaignBucketLabels[c.bucket]} ${c.campaign_id??''} ${c.account_id??''}`.toLocaleLowerCase('vi-VN').includes(search.toLocaleLowerCase('vi-VN')));
 const spendSortable=canSortCampaignSpend(filtered);
 if(sort.key==='spend'&&!spendSortable)sort={key:'conversations',direction:'desc'};
 const rows=sortCampaignQuality(filtered,sort);
 const spendTotal=campaignSpendTotal(rows);
 const received=data.campaigns.reduce((n,c)=>n+c.conversations,0);
 const assigned=data.campaigns.filter(c=>c.bucket==='campaign').reduce((n,c)=>n+c.conversations,0);
 const total=rows.reduce((n,c)=>({conversations:n.conversations+c.conversations,with_phone:n.with_phone+c.with_phone,qualified:n.qualified+c.qualified,duplicate:n.duplicate+c.duplicate,no_need:n.no_need+c.no_need,closed_tag:n.closed_tag+c.closed_tag}),{conversations:0,with_phone:0,qualified:0,duplicate:0,no_need:0,closed_tag:0});
 return <section id="campaign-quality" className="rounded-xl border border-slate-200 bg-white p-5">
  <h2 className="text-base font-bold">Chất lượng mess theo campaign</h2>
  <p className="mt-1 text-xs text-slate-600">Pancake ad_id → Meta ad_id → campaign. Mỗi hội thoại chỉ tính một lần; chỉ gán khi tất cả dấu vết xác định duy nhất một campaign. Không nối theo tên.</p>
  <p className="mt-2 text-xs text-slate-600">Đã gán {count(assigned)}/{count(received)} hội thoại. Còn {count(received-assigned)} ở nhóm riêng do thiếu, chưa rõ ad_id hoặc nhiều campaign. Bộ lọc dưới đây chỉ áp dụng bảng này; KPI phía trên vẫn theo toàn Page trong khoảng ngày.</p>
  <form key={`${from}:${to}:${account}:${search}:${sort.key}:${sort.direction}`} method="get" className="mt-3 flex flex-wrap items-center gap-2">
   <input type="hidden" name="sort" value={sort.key}/><input type="hidden" name="direction" value={sort.direction}/><input type="hidden" name="from" value={from}/><input type="hidden" name="to" value={to}/>
   <input name="campaign" aria-label="Tìm campaign" defaultValue={search} placeholder="Tên hoặc ID campaign" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" maxLength={120}/>
   <label className="text-xs text-slate-600">Tài khoản <select name="account" aria-label="Tài khoản campaign" defaultValue={account} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"><option value="all">Tất cả tài khoản và nhóm chưa gán</option>{accountIds.map(id=><option key={id} value={id}>{accounts[id]??'TKQC'} · {id}</option>)}<option value="unassigned">Chỉ nhóm chưa gán</option>{account!=='all'&&account!=='unassigned'&&!accountIds.includes(account)&&<option value={account}>ID không có trong dữ liệu: {account}</option>}</select></label>
   <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">Lọc campaign</button>
  </form>
  <div className="mt-4 overflow-x-auto">
   <table className="w-full min-w-[1380px] text-left text-xs">
    <thead><tr className="border-b text-slate-600">{campaignColumns.map(c=>{
     const next=nextCampaignSort(sort,c.key);const active=sort.key===c.key;
     const label=`Sắp xếp ${c.label} ${next.direction==='asc'?'tăng dần':'giảm dần'}`;
     if(c.key==='spend'&&!spendSortable)return <th key={c.key} scope="col" aria-sort="none" className="whitespace-nowrap py-2 pr-3"><span aria-disabled="true" title="Lọc một tài khoản hoặc cùng tiền tệ để sắp xếp chi tiêu; không so sánh khác/chưa rõ tiền tệ.">{c.label} ↕</span></th>;
     return <th key={c.key} scope="col" aria-sort={active?(sort.direction==='asc'?'ascending':'descending'):'none'} className="whitespace-nowrap py-2 pr-3"><Link href={campaignSortHref({from,to,campaign:search,account},next)} title={label} aria-label={label} className="inline-flex items-center gap-1 rounded-sm text-inherit underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">{c.label}<span aria-hidden="true" className={active?'text-blue-700':'text-slate-400'}>{active?(sort.direction==='asc'?'↑':'↓'):'↕'}</span></Link></th>;
    })}</tr></thead>
    <tbody>{rows.map(c=>{const status=campaignStatusView(c);return <tr key={`${c.bucket}:${c.account_id}:${c.campaign_id}`} className={`border-b ${c.bucket!=='campaign'?'bg-slate-50':''}`}>
     <td className="max-w-64 py-3 pr-3"><div className="font-medium">{c.bucket==='campaign'?c.campaign_name:campaignBucketLabels[c.bucket]}</div>{c.campaign_id&&<div className="mt-1 text-[10px] text-slate-500">{c.campaign_id}</div>}</td>
     <td className="pr-3">{c.account_id?<><div>{accounts[c.account_id]??'TKQC'}</div><div className="mt-1 text-[10px] text-slate-500">{c.account_id}</div></>:'—'}</td>
     <td className="min-w-[170px] py-2 pr-3">{c.bucket==='campaign'?<div title={status.title}><span className={`inline-block rounded border px-2 py-1 text-[11px] ${status.tone}`}>{status.code?status.label:'Chưa có dữ liệu từ webhook'}</span><div className="mt-1 text-[10px] text-slate-600">{status.note}</div>{status.when&&<time dateTime={c.meta_status_at??undefined} className="text-[10px] text-slate-500">{status.when}</time>}</div>:'—'}</td>
     <td className="min-w-[180px] py-2 pr-3" title={`Chi tiêu campaign từ webhook trong ${from}–${to}; không nhân theo mess.`}><div className={c.spend_received!==null&&c.spend_received!==undefined&&!c.spend_currency?'font-medium text-amber-900':'font-medium'}>{campaignSpendText(c.spend_received,c.spend_currency)}</div><div className="mt-1 text-[10px] text-slate-500">{campaignSpendNote(c)}</div>{c.spend_at&&<time dateTime={c.spend_at} className="text-[10px] text-slate-500">{new Date(c.spend_at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</time>}</td>
     <td>{count(c.conversations)}</td><td>{count(c.with_phone)}</td><td>{percent(c.with_phone,c.conversations)}</td><td>{count(c.qualified)}</td><td>{percent(c.qualified,c.conversations)}</td><td>{count(c.duplicate)}</td><td>{count(c.no_need)}</td><td>{count(c.closed_tag)}</td>
    </tr>})}</tbody>
    <tfoot><tr className="border-t-2 font-semibold"><td colSpan={3} className="py-3">Tổng bảng đang lọc</td><td className="pr-3">{campaignSpendText(spendTotal.amount,spendTotal.currency)}<div className="mt-1 text-[10px] font-normal text-slate-500">{spendTotal.issue??'Chi tiêu các campaign trong bảng'}{spendTotal.incomplete>0&&` · ${spendTotal.incomplete} campaign thiếu độ phủ`}</div></td><td>{count(total.conversations)}</td><td>{count(total.with_phone)}</td><td>{percent(total.with_phone,total.conversations)}</td><td>{count(total.qualified)}</td><td>{percent(total.qualified,total.conversations)}</td><td>{count(total.duplicate)}</td><td>{count(total.no_need)}</td><td>{count(total.closed_tag)}</td></tr></tfoot>
   </table>
   {!rows.length&&<p className="py-3 text-xs text-slate-600">Không có campaign/nhóm khớp bộ lọc trong các hội thoại đã nhận.</p>}
  </div>
  <p className="mt-3 text-xs text-slate-600">% SĐT = hội thoại có SĐT / hội thoại của dòng; % Qualified cũng dùng hội thoại của dòng. Các nhãn có thể chồng nhau; “Chốt đơn” không phải đơn/doanh số POS. Nhóm chưa gán không được phân bổ theo chi tiêu. Chi tiêu/trạng thái Meta chỉ đọc từ webhook; không dùng ảnh trạng thái cũ của nguồn khác. Chi tiêu cộng một lần theo campaign/ngày của nguồn Meta trong khoảng đang lọc (không tự chuyển múi giờ hay quy đổi tiền tệ), chỉ gồm các campaign có hội thoại đã nhận trong bảng, không phải tổng toàn tài khoản. Thiếu ngày/giá trị không phải 0; tiền tệ chưa rõ không cộng chung. Trạng thái nếu có là ảnh nguồn kèm thời điểm, không bảo đảm đang phân phối; ảnh quá 24 giờ được cảnh báo.</p>
 </section>;
}

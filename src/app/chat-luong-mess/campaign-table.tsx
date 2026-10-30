import { campaignBucketLabels, type CampaignQualityData } from '@/lib/pancake-campaign-quality';
const count=(n:number)=>n.toLocaleString('vi-VN');
const percent=(a:number,b:number)=>b>0?(a/b*100).toLocaleString('vi-VN',{maximumFractionDigits:1})+'%':'N/A';
const accounts:Record<string,string>={'1492352028605038':'Nam Khoa 2','1114645597047575':'Nam Khoa 3','3275227329354665':'Nam Khoa 3'};
export default function CampaignTable({data,from,to,query}:{data:CampaignQualityData;from:string;to:string;query:Record<string,string|string[]|undefined>}){
 const search=typeof query.campaign==='string'?query.campaign.trim().slice(0,120):'';
 const account=typeof query.account==='string'?query.account.slice(0,64):'all';
 const accountIds=[...new Set(data.campaigns.flatMap(c=>c.account_id?[c.account_id]:[]))].sort();
 const rows=data.campaigns.filter(c=>(account==='all'||(account==='unassigned'?c.bucket!=='campaign':c.account_id===account))&&`${c.campaign_name??campaignBucketLabels[c.bucket]} ${c.campaign_id??''} ${c.account_id??''}`.toLocaleLowerCase('vi-VN').includes(search.toLocaleLowerCase('vi-VN')));
 const received=data.campaigns.reduce((n,c)=>n+c.conversations,0);
 const assigned=data.campaigns.filter(c=>c.bucket==='campaign').reduce((n,c)=>n+c.conversations,0);
 const total=rows.reduce((n,c)=>({conversations:n.conversations+c.conversations,with_phone:n.with_phone+c.with_phone,qualified:n.qualified+c.qualified,duplicate:n.duplicate+c.duplicate,no_need:n.no_need+c.no_need,closed_tag:n.closed_tag+c.closed_tag}),{conversations:0,with_phone:0,qualified:0,duplicate:0,no_need:0,closed_tag:0});
 return <section className="rounded-xl border border-slate-200 bg-white p-5">
  <h2 className="text-base font-bold">Chất lượng mess theo campaign</h2>
  <p className="mt-1 text-xs text-slate-600">Pancake ad_id → Meta ad_id → campaign. Mỗi hội thoại chỉ tính một lần; chỉ gán khi tất cả dấu vết xác định duy nhất một campaign. Không nối theo tên.</p>
  <p className="mt-2 text-xs text-slate-600">Đã gán {count(assigned)}/{count(received)} hội thoại. Còn {count(received-assigned)} ở nhóm riêng do thiếu, chưa rõ ad_id hoặc nhiều campaign. Bộ lọc dưới đây chỉ áp dụng bảng này; KPI phía trên vẫn theo toàn Page trong khoảng ngày.</p>
  <form key={`${from}:${to}:${account}:${search}`} method="get" className="mt-3 flex flex-wrap items-center gap-2">
   <input type="hidden" name="from" value={from}/><input type="hidden" name="to" value={to}/>
   <input name="campaign" aria-label="Tìm campaign" defaultValue={search} placeholder="Tên hoặc ID campaign" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" maxLength={120}/>
   <label className="text-xs text-slate-600">Tài khoản <select name="account" aria-label="Tài khoản campaign" defaultValue={account} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"><option value="all">Tất cả tài khoản và nhóm chưa gán</option>{accountIds.map(id=><option key={id} value={id}>{accounts[id]??'TKQC'} · {id}</option>)}<option value="unassigned">Chỉ nhóm chưa gán</option>{account!=='all'&&account!=='unassigned'&&!accountIds.includes(account)&&<option value={account}>ID không có trong dữ liệu: {account}</option>}</select></label>
   <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">Lọc campaign</button>
  </form>
  <div className="mt-4 overflow-x-auto">
   <table className="w-full min-w-[1000px] text-left text-xs">
    <thead><tr className="border-b text-slate-600">{['Campaign / nhóm','Tài khoản','Hội thoại','Có SĐT','% SĐT','Qualified','% Qualified','Trùng khách','Ko có nhu cầu','Nhãn Chốt đơn'].map(h=><th key={h} className="whitespace-nowrap py-2 pr-3">{h}</th>)}</tr></thead>
    <tbody>{rows.map(c=><tr key={`${c.bucket}:${c.account_id}:${c.campaign_id}`} className={`border-b ${c.bucket!=='campaign'?'bg-slate-50':''}`}>
     <td className="max-w-64 py-3 pr-3"><div className="font-medium">{c.bucket==='campaign'?c.campaign_name:campaignBucketLabels[c.bucket]}</div>{c.campaign_id&&<div className="mt-1 text-[10px] text-slate-500">{c.campaign_id}</div>}</td>
     <td className="pr-3">{c.account_id?<><div>{accounts[c.account_id]??'TKQC'}</div><div className="mt-1 text-[10px] text-slate-500">{c.account_id}</div></>:'—'}</td>
     <td>{count(c.conversations)}</td><td>{count(c.with_phone)}</td><td>{percent(c.with_phone,c.conversations)}</td><td>{count(c.qualified)}</td><td>{percent(c.qualified,c.conversations)}</td><td>{count(c.duplicate)}</td><td>{count(c.no_need)}</td><td>{count(c.closed_tag)}</td>
    </tr>)}</tbody>
    <tfoot><tr className="border-t-2 font-semibold"><td colSpan={2} className="py-3">Tổng bảng đang lọc</td><td>{count(total.conversations)}</td><td>{count(total.with_phone)}</td><td>{percent(total.with_phone,total.conversations)}</td><td>{count(total.qualified)}</td><td>{percent(total.qualified,total.conversations)}</td><td>{count(total.duplicate)}</td><td>{count(total.no_need)}</td><td>{count(total.closed_tag)}</td></tr></tfoot>
   </table>
   {!rows.length&&<p className="py-3 text-xs text-slate-600">Không có campaign/nhóm khớp bộ lọc trong các hội thoại đã nhận.</p>}
  </div>
  <p className="mt-3 text-xs text-slate-600">% SĐT = hội thoại có SĐT / hội thoại của dòng; % Qualified cũng dùng hội thoại của dòng. Các nhãn có thể chồng nhau; “Chốt đơn” không phải đơn/doanh số POS. Nhóm chưa gán không được phân bổ theo chi tiêu.</p>
 </section>;
}

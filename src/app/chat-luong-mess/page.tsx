import { Suspense } from 'react';
import Link from 'next/link';
import { connection } from 'next/server';
import { reportClient } from '@/lib/supabase-server';
import { reportRange } from '@/lib/report';
import { qualitySummary } from '@/lib/pancake-quality';
import { webhookCampaignQualityData } from '@/lib/campaign-webhook-quality';
import CampaignTable from './campaign-table';
import { campaignSort } from '@/lib/campaign-quality-sort';
export const metadata={title:'Chất lượng mess · Pancake'};
const fmt=(v:number|null)=>v===null?'—':v.toLocaleString('vi-VN');
const pct=(v:number|null)=>v===null?'N/A':(v*100).toLocaleString('vi-VN',{maximumFractionDigits:1})+'%';
const stamp=(v:string|null)=>v?new Date(v).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'chưa có';
const shift=(date:string,n:number)=>new Date(Date.parse(date)+n*86400_000).toISOString().slice(0,10);
function State({code,text}:{code:string;text:string}){return <main className="mx-auto max-w-7xl space-y-4 bg-slate-50 p-6 text-slate-900"><h1 className="text-xl font-bold">Chất lượng mess Pancake</h1><p role="alert">{text}</p><p className="text-xs text-slate-500">{code}</p><Link className="underline" href="/dang-nhap?next=%2Fchat-luong-mess">Đăng nhập</Link><Link className="ml-4 underline" href="/bao-cao">Về báo cáo Ads</Link></main>}
async function Content({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await connection();const query=await searchParams;const range=reportRange(query.from,query.to);
 if(!range)return <State code="invalid_range" text="Khoảng ngày không hợp lệ. Chọn tối đa 367 ngày."/>;
 const db=await reportClient();if(!db)return <State code="not_configured" text="Chưa cấu hình kết nối DB báo cáo. Không dùng số liệu mẫu thay thế."/>;
 const load=async():Promise<{raw:unknown}|{code:string;text:string}>=>{
  try{
   const {data:{user},error}=await db.auth.getUser();if(error||!user)return {code:'authentication_required',text:'Đăng nhập tài khoản marketing/admin để xem số liệu tổng hợp.'};
   const {data:members,error:memberError}=await db.from('memberships').select('workspace_id').eq('user_id',user.id).eq('active',true).in('role',['admin','marketing']);
   if(memberError||!members?.length)return {code:'forbidden',text:'Tài khoản chưa có quyền xem số liệu của workspace.'};
   if(members.length!==1)return {code:'workspace_selection_required',text:'Có nhiều workspace; chưa chọn được phạm vi an toàn nên không tự gộp.'};
   const {data,error:rpcError}=await db.rpc('report_pancake_campaign_webhook_quality',{p_workspace_id:members[0].workspace_id,p_from:range.from,p_to:range.to});
   if(rpcError)return {code:'unavailable',text:'Chưa đọc được số liệu Pancake. Cần kiểm tra migration và nguồn đồng bộ; không coi đây là 0 hội thoại.'};
   return {raw:data};
  }catch{return {code:'unavailable',text:'Không kết nối được DB. Thử tải lại; không hiển thị số liệu giả hoặc số cũ thay thế.'};}
 };
 const result=await load();if('code' in result)return <State {...result}/>;
 const data=webhookCampaignQualityData(result.raw);if(!data)return <State code="invalid_response" text="Dữ liệu không đúng hợp đồng tổng hợp; chưa hiển thị để tránh tính sai."/>;
 const expectedDays=Math.round((Date.parse(range.to)-Date.parse(range.from))/86400_000)+1;
 if(data.days.length!==expectedDays||data.days.some(d=>d.day<range.from||d.day>range.to))return <State code="incomplete_response" text="Khoảng ngày trả về thiếu hoặc sai phạm vi; chưa tính tổng."/>;
 const sort=campaignSort(query);
 const s=qualitySummary(data);const today=reportRange(undefined,undefined)!.to;
 const presets=[{label:'Hôm nay',from:today,to:today},{label:'Hôm qua',from:shift(today,-1),to:shift(today,-1)},{label:'3 ngày',from:shift(today,-2),to:today},{label:'7 ngày',from:shift(today,-6),to:today}];
 const cards=[
  {label:'Hội thoại đã nhận',value:fmt(s.total),foot:'Theo inserted_at; không phải số engaged đã xác minh'},
  {label:'Có SĐT',value:fmt(s.phones),foot:`${pct(s.phoneRate)} trên hội thoại đã nhận`},
  {label:'Qualified',value:fmt(s.qualified),foot:`${pct(s.qualifiedRate)} hội thoại · ${pct(s.qualifiedPhoneRate)} trên nhóm có SĐT`},
  {label:'Chưa gắn nhãn',value:fmt(s.unlabelled),foot:'Không có nhãn nguồn đang active'},
  {label:'Có dấu vết quảng cáo',value:fmt(s.withAd),foot:'Có ad_touches; không khẳng định thuộc một TKQC cụ thể'},
  {label:'Hội thoại bị loại',value:fmt(s.excluded),foot:`Không nằm trong mẫu số chính · ${fmt(s.unknown)} còn trạng thái eligibility chưa rõ`},
 ];
 return <main className="mx-auto min-h-screen max-w-7xl space-y-5 bg-slate-50 p-4 text-slate-900 sm:p-6">
  <div role="note" className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sm text-sky-900"><b>Pancake · Page {data.page_id}.</b> Pancake cập nhật 6 giờ/lần. Đồng bộ nguồn: {stamp(data.synced_at)}. Meta cập nhật riêng qua webhook; chi tiêu/trạng thái có mốc nguồn riêng. Chỉ là số liệu các hội thoại đã nhận, chưa chứng nhận đầy đủ. Nhãn là trạng thái hiện tại, không phải lịch sử tại thời điểm tạo hội thoại. {!data.source_configured&&<strong> Nguồn chưa được bật.</strong>}</div>
  <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-bold">Chất lượng mess Pancake</h1><p className="text-xs text-slate-600">Tổng hợp theo ngày tạo hội thoại · Giờ Việt Nam · Không hiển thị SĐT/nội dung khách</p></div><Link href="/bao-cao" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">Về báo cáo Ads</Link></header>
  <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Chọn khoảng thời gian">{presets.map(p=><Link key={p.label} href={`?from=${p.from}&to=${p.to}&sort=${sort.key}&direction=${sort.direction}`} className={`rounded-lg border px-3 py-1.5 text-sm ${range.from===p.from&&range.to===p.to?'border-blue-600 bg-blue-600 text-white':'border-slate-300 bg-white text-slate-800'}`}>{p.label}</Link>)}<form key={`${range.from}:${range.to}:${sort.key}:${sort.direction}`} method="get" className="flex flex-wrap items-center gap-2"><input type="hidden" name="sort" value={sort.key}/><input type="hidden" name="direction" value={sort.direction}/><label className="text-sm">Từ <input className="rounded-lg border border-slate-300 bg-white px-2 py-1" type="date" name="from" defaultValue={range.from} required/></label><label className="text-sm">đến <input className="rounded-lg border border-slate-300 bg-white px-2 py-1" type="date" name="to" defaultValue={range.to} required/></label><button className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white">Xem số liệu</button></form></div>
  <p className="text-xs text-slate-600">Đang xem {range.from} – {range.to}: {s.observedDays}/{data.days.length} ngày có bản ghi. Ngày không có bản ghi hiện —, không tự coi là không có khách.</p>
  <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">{cards.map(c=><div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="text-xs text-slate-600">{c.label}</h2><p className="mt-2 text-2xl font-bold">{c.value}</p><p className="mt-2 text-xs text-slate-600">{c.foot}</p></div>)}</section>
  <CampaignTable data={data} from={range.from} to={range.to} query={query}/>
  <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-base font-bold">Bảng theo ngày</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b text-slate-600">{['Ngày','Hội thoại','Có SĐT','Tỷ lệ SĐT','Qualified','Chưa nhãn','Có dấu vết Ads','Bị loại'].map(h=><th key={h} className="whitespace-nowrap py-2 pr-4">{h}</th>)}</tr></thead><tbody>{data.days.map(d=><tr key={d.day} className="border-b"><td className="whitespace-nowrap py-2 pr-4">{d.day}</td><td>{fmt(d.conversations)}</td><td>{fmt(d.with_phone)}</td><td>{pct(d.conversations&&d.with_phone!==null?d.with_phone/d.conversations:null)}</td><td>{fmt(d.qualified)}</td><td>{fmt(d.unlabelled)}</td><td>{fmt(d.with_ad)}</td><td>{fmt(d.excluded)}</td></tr>)}</tbody></table></div></section>
  <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm" open><summary className="cursor-pointer font-semibold">Định nghĩa và giới hạn</summary><ul className="mt-3 list-disc space-y-2 pl-5 text-xs text-slate-700"><li>Qualified = có SĐT và nhãn nguồn active XTS, RLCD hoặc XTS + RLCD; không phải chẩn đoán, lịch khám hay đơn bán.</li><li>Tỷ lệ SĐT ở đây dùng toàn bộ hội thoại đã nhận, không phải engaged conversations; không áp ngưỡng engaged khi chưa có số tin nhắn khách.</li><li>Chưa đo được một-tin-nhắn, thời gian phản hồi, bỏ sót xin SĐT hoặc im lặng sau sale từ schema hiện tại. Không suy diễn các chỉ số này.</li><li>Nhãn “Chốt đơn” nếu có chỉ là nhãn vận hành; không thay cho đơn hợp lệ hoặc doanh số POS.</li><li>Nguồn đọc theo inserted_at và ảnh nhãn hiện tại; một khách có thể có nhiều hội thoại. Không gọi số hội thoại là số khách duy nhất.</li></ul></details>
 </main>;
}
export default function Page(props:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <Suspense fallback={<p>Đang tải chất lượng mess…</p>}><Content {...props}/></Suspense>}

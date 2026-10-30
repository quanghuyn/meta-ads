export type CampaignMetaStatus={meta_status:string|null;meta_effective_status:string|null;meta_status_at:string|null;meta_status_source:'webhook_snapshot'|'legacy_metadata'|null};
export const metaStatusKeys=['meta_status','meta_effective_status','meta_status_at','meta_status_source']as const;
const empty=():CampaignMetaStatus=>({meta_status:null,meta_effective_status:null,meta_status_at:null,meta_status_source:null});
export function readCampaignMetaStatus(value:unknown):CampaignMetaStatus|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;const r=value as Record<string,unknown>;
 const present=metaStatusKeys.filter(k=>Object.hasOwn(r,k));if(!present.length)return empty();if(present.length!==4)return null;
 for(const k of ['meta_status','meta_effective_status'])if(r[k]!==null&&(typeof r[k]!=='string'||!/^[A-Z_]{1,64}$/.test(r[k] as string)))return null;
 if(r.meta_status===null&&r.meta_effective_status===null)return r.meta_status_at===null&&r.meta_status_source===null?empty():null;
 if(typeof r.meta_status_at!=='string'||!Number.isFinite(Date.parse(r.meta_status_at)))return null;
 if(r.meta_status_source!=='webhook_snapshot'&&r.meta_status_source!=='legacy_metadata')return null;
 return{meta_status:r.meta_status as string|null,meta_effective_status:r.meta_effective_status as string|null,meta_status_at:r.meta_status_at,meta_status_source:r.meta_status_source};
}
const labels:Record<string,string>={ACTIVE:'Đã bật',PAUSED:'Tạm dừng',ARCHIVED:'Đã lưu trữ',DELETED:'Đã xóa'};
export function campaignStatusView(row:Partial<CampaignMetaStatus>,now=Date.now()){
 const s=readCampaignMetaStatus(row);const code=s?.meta_effective_status??s?.meta_status??null;
 if(!s||!code||!s.meta_status_at)return{label:'Chưa có dữ liệu',code:null,when:null,note:'Không suy từ chi tiêu',tone:'border-slate-200 bg-slate-50 text-slate-600',title:'Chưa có trạng thái Meta có nguồn và thời điểm xác minh.'};
 const age=now-Date.parse(s.meta_status_at);const stale=age>24*60*60*1000;const future=age< -5*60*1000||!Number.isFinite(age);
 const label=(labels[code]??`Mã Meta: ${code}`)+(s.meta_effective_status?'':' (cấu hình)');
 const when=new Date(s.meta_status_at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
 const note=future?'Thời điểm cần kiểm tra':stale?'Ảnh cũ >24h':s.meta_status_source==='legacy_metadata'?'Metadata đã nhận':'Ảnh nguồn đã nhận';
 const tone=stale||future?'border-amber-300 bg-amber-50 text-amber-900':code==='ACTIVE'?(s.meta_effective_status?'border-emerald-200 bg-emerald-50 text-emerald-800':'border-sky-200 bg-sky-50 text-sky-800'):'border-slate-200 bg-slate-50 text-slate-700';
 return{label,code,when,note,tone,title:`${s.meta_status_source}; status=${s.meta_status??'—'}; effective_status=${s.meta_effective_status??'—'}; ${s.meta_status_at}. Đây là ảnh metadata, không bảo đảm đang phân phối tại thời điểm xem.`};
}

import { DASHBOARD_ACCOUNTS, type DashboardData, type DashboardCampaign, type DashboardDay } from './dashboard-data';
export type PosDashboardRow = {
 day: string; bucket: string; account_id: string | null; campaign_id: string | null; campaign_name: string | null;
 orders: number | string | null; total_sale: number | string | null; orders_ad: number | string | null;
 sale_ad: number | string | null; pos_synced_at: string | null;
};
const n=(v:number|string|null)=>v===null||!Number.isFinite(Number(v))?NaN:Number(v);
export type PosDashboardData = DashboardData & {
 posSyncedAt:string|null; posAvailable:boolean;
 unattributedDaily:{date:string;unmapped:{orders:number;sale:number};noAd:{orders:number;sale:number}}[];
};
export function withPos(base:DashboardData,pos:PosDashboardRow[]|null):PosDashboardData {
 const shops=new Map((pos??[]).filter(r=>r.bucket==='shop').map(r=>[r.day,r]));
 const daily=new Map(base.dayRows.map(r=>[r.date,{...r}]));
 const missing=()=>({spend:NaN,impressions:NaN,clicks:NaN});
 for(const [date,r] of shops){
  const d:DashboardDay=daily.get(date)??{date,nk2:missing(),nk3:missing(),orders:NaN,sale:NaN,ordersAd:NaN,saleAd:NaN,inbox:NaN,phones:NaN};
  d.orders=n(r.orders);d.sale=n(r.total_sale);d.ordersAd=n(r.orders_ad);d.saleAd=n(r.sale_ad);daily.set(date,d);
 }
 const campaigns=new Map(base.campaignDaily.map(r=>{
  const known=Number.isFinite(n(shops.get(r.date)?.orders??null));
  return[`${r.date}:${r.id}`,{...r,orders:known?0:NaN,sale:known?0:NaN}];
 }));
 const accountNames=new Map<string,string>([[DASHBOARD_ACCOUNTS.nk2,'Nam Khoa 2'],[DASHBOARD_ACCOUNTS.nk3,'Nam Khoa 3']]);
 const unattributedDaily=[...shops].map(([date,r])=>({date,
  unmapped:{orders:Number.isFinite(n(r.orders))?0:NaN,sale:Number.isFinite(n(r.total_sale))?0:NaN},
  noAd:{orders:Number.isFinite(n(r.orders))?0:NaN,sale:Number.isFinite(n(r.total_sale))?0:NaN}}));
 for(const r of pos??[]){
  if(r.bucket==='shop')continue;
  const id=`${r.account_id}:${r.campaign_id}`;
  const key=`${r.day}:${id}`;
  const account=accountNames.get(r.account_id??'');
  if(r.bucket==='campaign'&&r.campaign_id&&account){
   const c:DashboardCampaign=campaigns.get(key)??{date:r.day,id,name:r.campaign_name??r.campaign_id,account,accountId:r.account_id!,spend:NaN,impressions:NaN,clicks:NaN,orders:0,sale:0};
   c.orders=n(r.orders);c.sale=n(r.total_sale);campaigns.set(key,c);
  }else{
   const d=unattributedDaily.find(d=>d.date===r.day);if(!d)throw Error('pos_bucket_without_shop');
   const b=r.bucket==='no_ad_id'?d.noAd:d.unmapped;b.orders+=n(r.orders);b.sale+=n(r.total_sale);
  }
 }
 const stamps=(pos??[]).map(r=>r.pos_synced_at).filter((r):r is string=>Boolean(r));
 return{...base,dayRows:[...daily.values()].sort((a,b)=>a.date.localeCompare(b.date)),campaignDaily:[...campaigns.values()],
  posSyncedAt:stamps.sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1)??null,posAvailable:pos!==null,unattributedDaily};
}

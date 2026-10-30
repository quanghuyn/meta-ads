import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
const open:PGlite[]=[];
afterEach(async()=>{for(const db of open.splice(0))await db.close()});
async function seed(){
 const db=new PGlite();open.push(db);
 await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key default gen_random_uuid());create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
 const dir=join(process.cwd(),'supabase/migrations');for(const f of readdirSync(dir).filter(f=>f.endsWith('.sql')&&!f.includes('schedule_sync')).sort())await db.exec(readFileSync(join(dir,f),'utf8'));
 const id=async(q:string,p:unknown[]=[]) => (await db.query<{id:string}>(q,p)).rows[0].id;
 const w=await id(`insert into workspaces(name)values('synthetic')returning id`);
 const u=await id(`insert into auth.users default values returning id`);
 await db.query(`insert into memberships(workspace_id,user_id,role)values($1,$2,'marketing')`,[w,u]);
 const pos=await id(`insert into source_connections(workspace_id,provider,source_id,state,last_success_at)values($1,'pos','1546758','active','2026-01-03T04:00:00Z')returning id`,[w]);
 const conn=await id(`insert into source_connections(workspace_id,provider,source_id,state)values($1,'meta','9000000000000001','active')returning id`,[w]);
 const camp=await id(`insert into ad_entities(workspace_id,connection_id,kind,source_id,name)values($1,$2,'campaign','111','synthetic campaign')returning id`,[w,conn]);
 await db.query(`insert into ad_entities(workspace_id,connection_id,kind,source_id,parent_id)values($1,$2,'ad','222',$3)`,[w,conn,camp]);
 const order=async(name:string,day:string,amount:number,ad:string|null,included=true)=>{
  const o=await id(`insert into orders(workspace_id,connection_id,source_id,source_ad_id,order_created_at,source_status,currency)values($1,$2,$3,$4,$5,'synthetic','VND')returning id`,[w,pos,name,ad,day+'T03:00:00Z']);
  await db.query(`insert into order_total_sale_facts(workspace_id,order_id,contract_version,source_fact_key,recognition_date,included,amount,currency)values($1,$2,1,'order',$3,$4,$5,'VND')`,[w,o,day,included,amount]);
 };
 const login=async()=>{await db.exec('set role authenticated');await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[u]);};
 const report=()=>db.query<{day:string;bucket:string;total_sale:string|null;orders:number|null;orders_ad:number|null;account_id:string|null}>(`select * from report_pos_dashboard($1,'2026-01-01','2026-01-03')`,[w]);
 return{db,w,u,conn,camp,order,login,report};
}
describe('POS dashboard aggregate contract',()=>{
 it('preserves shop totals, ad attribution, unknown/no-ad buckets, and missing-day nulls',async()=>{
  const s=await seed();await s.order('one','2026-01-01',100,'222');await s.order('two','2026-01-01',200,null);await s.order('three','2026-01-01',300,'999');await s.order('excluded','2026-01-02',500,null,false);await s.login();
  const r=(await s.report()).rows;
  const shop=r.filter(r=>r.bucket==='shop');expect(Number(shop[0].total_sale)).toBe(600);expect(shop[0].orders).toBe(3);expect(shop[0].orders_ad).toBe(2);
  expect(Number(shop[1].total_sale)).toBe(0);expect(shop[1].orders).toBe(0);expect(shop[2].total_sale).toBeNull();expect(shop[2].orders).toBeNull();
  expect(r.find(r=>r.bucket==='campaign')).toMatchObject({account_id:'9000000000000001',orders:1,total_sale:'100.0000'});
  expect(r.find(r=>r.bucket==='no_ad_id')?.orders).toBe(1);expect(r.find(r=>r.bucket==='ad_unknown')?.orders).toBe(1);
  expect(r.filter(r=>r.bucket!=='shop').reduce((a,b)=>a+Number(b.total_sale),0)).toBe(Number(shop[0].total_sale));
  await expect(s.db.query('select * from orders')).rejects.toThrow();
 });
 it('quarantines conflicting ad ownership instead of assigning revenue by name',async()=>{
  const s=await seed();
  const c=(await s.db.query<{id:string}>(`insert into source_connections(workspace_id,provider,source_id,state)values($1,'meta','9000000000000002','active')returning id`,[s.w])).rows[0].id;
  const p=(await s.db.query<{id:string}>(`insert into ad_entities(workspace_id,connection_id,kind,source_id,name)values($1,$2,'campaign','333','synthetic campaign')returning id`,[s.w,c])).rows[0].id;
  await s.db.query(`insert into ad_entities(workspace_id,connection_id,kind,source_id,parent_id)values($1,$2,'ad','222',$3)`,[s.w,c,p]);
  await s.order('ambiguous','2026-01-01',100,'222');await s.login();const r=(await s.report()).rows;
  expect(r.find(r=>r.bucket==='campaign')).toBeUndefined();expect(r.find(r=>r.bucket==='ad_unknown')?.orders).toBe(1);
 });
 it('rejects outsiders/sales and invalid ranges without exposing raw orders',async()=>{
  const s=await seed();await s.login();
  await expect(s.db.query(`select * from report_pos_dashboard($1,'2026-01-03','2026-01-01')`,[s.w])).rejects.toThrow();
  await s.db.query(`select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)`);await expect(s.report()).rejects.toThrow('forbidden');
  await s.db.exec('reset role');await s.db.query(`update memberships set role='sales' where user_id=$1`,[s.u]);await s.login();await expect(s.report()).rejects.toThrow('forbidden');
 });
});

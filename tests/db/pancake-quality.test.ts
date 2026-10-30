import {PGlite} from '@electric-sql/pglite';
import {readdirSync,readFileSync} from 'node:fs';import{join}from'node:path';
import{afterEach,describe,expect,it}from'vitest';
import{campaignQualityData,type CampaignQualityData}from'../../src/lib/pancake-campaign-quality';
import{webhookCampaignQualityData}from'../../src/lib/campaign-webhook-quality';
const open:PGlite[]=[];afterEach(async()=>{for(const db of open.splice(0))await db.close()});
async function seed(){const db=new PGlite();open.push(db);
 await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key default gen_random_uuid());create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
 const dir=join(process.cwd(),'supabase/migrations');for(const f of readdirSync(dir).filter(f=>f.endsWith('.sql')&&!f.includes('schedule_sync')).sort())await db.exec(readFileSync(join(dir,f),'utf8'));
 const id=async(q:string,p:unknown[]=[]) => (await db.query<{id:string}>(q,p)).rows[0].id;
 const w=await id(`insert into workspaces(name)values('synthetic')returning id`),u=await id(`insert into auth.users default values returning id`);
 await db.query(`insert into memberships(workspace_id,user_id,role)values($1,$2,'marketing')`,[w,u]);
 const c=await id(`insert into source_connections(workspace_id,provider,source_id,state,last_success_at)values($1,'inbox','196059750263125','active','2026-01-03T03:00:00Z')returning id`,[w]);
 const conv=async(name:string,phone:boolean,stamp='2026-01-01T18:00:00Z',eligible='eligible')=>id(`insert into conversations(workspace_id,connection_id,source_id,source_inserted_at,has_phone,eligibility)values($1,$2,$3,$4,$5,$6::app.eligibility)returning id`,[w,c,name,stamp,phone,eligible]);
 const tag=async(cv:string,name:string,key:string,active=true,origin='source')=>db.query(`insert into conversation_evidence(workspace_id,conversation_id,kind,dedupe_key,value,observed_at,active,origin)values($1,$2,'tag',$3,jsonb_build_object('text',$4::text),now(),$5,$6)`,[w,cv,key,name,active,origin]);
 const login=async()=>{await db.exec('set role authenticated');await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[u]);};
 const report=()=>db.query<{result:{days:Record<string,unknown>[];tags:Record<string,unknown>[]}}>(`select report_pancake_quality($1,'2026-01-01','2026-01-03') as result`,[w]);
 return{db,w,u,c,conv,tag,login,report};}
describe('aggregate Pancake quality',()=>{
 it('counts unique conversations/current overlapping tags, uses VN dates and requires phone for qualified',async()=>{
  const s=await seed();const a=await s.conv('synthetic-a',true),b=await s.conv('synthetic-b',false),c=await s.conv('synthetic-c',true);await s.conv('excluded',true,undefined,'excluded');
  await s.tag(a,'XTS','one');await s.tag(a,'XTS','duplicate-evidence');await s.tag(a,'Trùng khách','dup');await s.tag(b,'RLCD','need');await s.tag(c,'XTS','inactive',false);await s.tag(c,'RLCD','manual',true,'manual');
  await s.db.query(`insert into ad_touches(workspace_id,conversation_id,source_ad_id,observed_at,source_event_key)values($1,$2,'synthetic-ad',now(),'touch-one')`,[s.w,a]);await s.login();const r=(await s.report()).rows[0].result;
  expect(r.days[0].conversations).toBeNull();expect(r.days[1]).toMatchObject({day:'2026-01-02',conversations:3,with_phone:2,qualified:1,with_ad:1,unlabelled:1,excluded:1});expect(r.days[2].conversations).toBeNull();
  expect(r.tags.find(t=>t.tag==='XTS')?.conversations).toBe(1);expect(r.tags.find(t=>t.tag==='Trùng khách')?.conversations).toBe(1);expect(r.tags.find(t=>t.tag==='RLCD')?.conversations).toBe(1);
  expect(JSON.stringify(r)).not.toContain('synthetic-a');await expect(s.db.query('select * from conversations')).rejects.toThrow();
 });
 it('suppresses phone-like tag text and rejects outsiders, sales, anonymous and invalid ranges',async()=>{
  const s=await seed();const a=await s.conv('synthetic',false);await s.tag(a,'Phone 0900000000','private');await s.login();expect((await s.report()).rows[0].result.tags).toEqual([]);
  await expect(s.db.query(`select report_pancake_quality($1,'2026-01-03','2026-01-01')`,[s.w])).rejects.toThrow();
  await s.db.query(`select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)`);await expect(s.report()).rejects.toThrow('forbidden');
  await s.db.exec('reset role');await s.db.query(`update memberships set role='sales' where user_id=$1`,[s.u]);await s.login();await expect(s.report()).rejects.toThrow('forbidden');await s.db.exec('set role anon');await expect(s.report()).rejects.toThrow();
 });
});

type Fixture=Awaited<ReturnType<typeof seed>>;
async function meta(s:Fixture,account:string,campaign:string,ads:string[]){
 const c=(await s.db.query<{id:string}>(`insert into source_connections(workspace_id,provider,source_id,state)values($1,'meta',$2,'active')on conflict(workspace_id,provider,source_id)do update set state='active'returning id`,[s.w,account])).rows[0].id;
 const cp=(await s.db.query<{id:string}>(`insert into ad_entities(workspace_id,connection_id,kind,source_id,name)values($1,$2,'campaign',$3,'Same campaign name')returning id`,[s.w,c,campaign])).rows[0].id;
 for(const ad of ads)await s.db.query(`insert into ad_entities(workspace_id,connection_id,kind,source_id,parent_id)values($1,$2,'ad',$3,$4)`,[s.w,c,ad,cp]);return c;
}
async function touch(s:Fixture,cv:string,ad:string,key:string){await s.db.query(`insert into ad_touches(workspace_id,conversation_id,source_ad_id,observed_at,source_event_key)values($1,$2,$3,now(),$4)`,[s.w,cv,ad,key]);}
async function campaigns(s:Fixture){return(await s.db.query<{result:CampaignQualityData}>(`select report_pancake_campaign_quality($1,'2026-01-01','2026-01-03') as result`,[s.w])).rows[0].result;}
async function moneyRoute(s:Fixture,c:string,currency:string|null){await s.db.query(`update source_connections set currency=$2 where id=$1`,[c,currency]);await s.db.query(`insert into meta_webhook_routes(workspace_id,connection_id,report_level,enabled)values($1,$2,'campaign',true)`,[s.w,c]);}
async function moneyFacts(s:Fixture){
 const inbox=(await s.db.query<{id:string}>(`insert into meta_webhook_inbox(payload,payload_bytes)values('{"_test":true}',14)returning id`)).rows[0].id;await s.db.query(`insert into meta_webhook_deliveries(delivery_id,inbox_id,payload)values('unit-money',$1,'{}')`,[inbox]);
 return async(c:string,id:string,day:string,amount:number|null,raw:Record<string,unknown>={},level:'campaign'|'ad'='campaign',parent:string|null=null)=>s.db.query(`insert into meta_webhook_facts(workspace_id,connection_id,level,entity_id,source_date,entity_name,campaign_id,spend,generated_at,delivery_id,inbox_id,raw_row)values($1,$2,$3::app.ad_entity_kind,$4,$5,'Synthetic source',$6,$7,'2026-01-04T00:00:00Z','unit-money',$8,$9::jsonb)`,[s.w,c,level,id,day,parent,amount,inbox,JSON.stringify(raw)]);
}
async function webhookMetrics(s:Fixture){const raw=(await s.db.query<{result:unknown}>(`select report_pancake_campaign_webhook_quality($1,'2026-01-01','2026-01-02') as result`,[s.w])).rows[0].result;const parsed=webhookCampaignQualityData(raw);expect(parsed).not.toBeNull();return parsed!;}
describe('Pancake ad_id -> Meta campaign quality',()=>{
 it('deduplicates same-campaign touches, keeps accounts distinct, quarantines unknown/multiple campaigns and reconciles totals',async()=>{
  const s=await seed();await meta(s,'9101','311',['211','212']);await meta(s,'9102','311',['213']);
  const a=await s.conv('same-campaign',true);for(const[tag,key]of[['XTS','need'],['Trùng khách','dup'],['Ko có nhu cầu','noneed'],['Chốt đơn','close']])await s.tag(a,tag,key);
  await touch(s,a,'211','a1');await touch(s,a,'211','a2');await touch(s,a,'212','a3');
  const b=await s.conv('other-account',false);await touch(s,b,'213','b1');await s.conv('no-ad',false);
  const c=await s.conv('unknown',true);await touch(s,c,'999','c1');
  const d=await s.conv('multiple',true);await touch(s,d,'211','d1');await touch(s,d,'213','d2');
  const e=await s.conv('partial',false);await touch(s,e,'211','e1');await touch(s,e,'888','e2');
  const x=await s.conv('excluded',true,undefined,'excluded');await touch(s,x,'211','x1');
  await s.login();const raw=await campaigns(s);expect(campaignQualityData(raw)).not.toBeNull();const r=raw.campaigns;
  expect(r.reduce((n,c)=>n+c.conversations,0)).toBe(6);
  expect(r.find(c=>c.bucket==='campaign'&&c.account_id==='9101')).toMatchObject({conversations:1,with_phone:1,qualified:1,duplicate:1,no_need:1,closed_tag:1});
  expect(r.filter(c=>c.bucket==='campaign')).toHaveLength(2);expect(r.find(c=>c.bucket==='unknown_ad')?.conversations).toBe(2);expect(r.find(c=>c.bucket==='multi_campaign')?.conversations).toBe(1);expect(r.find(c=>c.bucket==='no_ad_id')?.conversations).toBe(1);
  expect(JSON.stringify(raw)).not.toContain('same-campaign');
 });
 it('joins webhook ad IDs including quoted Pancake IDs and quarantines conflicts with legacy ownership',async()=>{
  const s=await seed();await meta(s,'9101','311',['211']);const c=(await s.db.query<{id:string}>(`insert into source_connections(workspace_id,provider,source_id,state)values($1,'meta','9102','active')returning id`,[s.w])).rows[0].id;
  await meta(s,'9102','312',['214']);
  const inbox=(await s.db.query<{id:string}>(`insert into meta_webhook_inbox(payload,payload_bytes)values('{"_test":true}',14)returning id`)).rows[0].id;
  await s.db.query(`insert into meta_webhook_deliveries(delivery_id,inbox_id,payload)values('unit-campaign',$1,'{}')`,[inbox]);
  for(const[level,id,camp]of[['campaign','312',null],['ad','211','312'],['ad','214','312']])await s.db.query(`insert into meta_webhook_facts(workspace_id,connection_id,level,entity_id,source_date,entity_name,campaign_id,generated_at,delivery_id,inbox_id,raw_row)values($1,$2,$3::app.ad_entity_kind,$4,'2026-01-02','A webhook campaign',$5,now(),'unit-campaign',$6,'{}')`,[s.w,c,level,id,camp,inbox]);
  const a=await s.conv('conflict',false);await touch(s,a,'211','conflict');const b=await s.conv('quoted',true);await touch(s,b,"'214",'quoted');await s.login();const r=(await campaigns(s)).campaigns;
  expect(r.find(c=>c.bucket==='unknown_ad')?.conversations).toBe(1);expect(r.find(c=>c.bucket==='campaign')).toMatchObject({account_id:'9102',campaign_id:'312',campaign_name:'A webhook campaign',conversations:1});
 });
 it('enriches status by exact account/campaign without changing conversation totals; missing/groups stay unknown',async()=>{
  const s=await seed();await meta(s,'9101','311',['211']);await meta(s,'9102','311',['212']);await meta(s,'9103','313',['213']);
  await s.db.query(`update ad_entities e set source_status=case c.source_id when '9101' then 'ACTIVE' when '9102' then 'PAUSED' end from source_connections c where c.id=e.connection_id and c.workspace_id=e.workspace_id and e.workspace_id=$1 and e.kind='campaign'`,[s.w]);
  for(const[cv,ad]of[['one','211'],['two','212'],['missing','213']]){const id=await s.conv(cv,true);await touch(s,id,ad,cv);}await s.conv('no-status-group',false);await s.login();
  const before=await campaigns(s);const result=(await s.db.query<{result:CampaignQualityData}>(`select report_pancake_campaign_status_quality($1,'2026-01-01','2026-01-03') as result`,[s.w])).rows[0].result;
  expect(campaignQualityData(result)).not.toBeNull();expect(result.campaigns).toHaveLength(before.campaigns.length);result.campaigns.forEach((r,i)=>expect(r).toMatchObject(before.campaigns[i]));
  expect(result.campaigns.find(r=>r.account_id==='9101')).toMatchObject({meta_status:'ACTIVE',meta_effective_status:null,meta_status_source:'legacy_metadata'});expect(result.campaigns.find(r=>r.account_id==='9102')?.meta_status).toBe('PAUSED');
  expect(result.campaigns.find(r=>r.account_id==='9103')).toMatchObject({meta_status:null,meta_effective_status:null,meta_status_at:null,meta_status_source:null});expect(result.campaigns.find(r=>r.bucket==='no_ad_id')?.meta_status).toBeNull();
  await s.db.query(`select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)`);await expect(s.db.query(`select report_pancake_campaign_status_quality($1,'2026-01-01','2026-01-03')`,[s.w])).rejects.toThrow('forbidden');
 });
 it('preserves configured/effective state from one newer webhook snapshot, rather than blending metadata sources',async()=>{
  const s=await seed();const c=await meta(s,'9101','311',['211']);await s.db.query(`update ad_entities set source_status='PAUSED' where workspace_id=$1 and kind='campaign'`,[s.w]);
  const inbox=(await s.db.query<{id:string}>(`insert into meta_webhook_inbox(payload,payload_bytes)values('{"_test":true}',14)returning id`)).rows[0].id;await s.db.query(`insert into meta_webhook_deliveries(delivery_id,inbox_id,payload)values('status-unit',$1,'{}')`,[inbox]);
  await s.db.query(`insert into meta_webhook_facts(workspace_id,connection_id,level,entity_id,source_date,entity_name,generated_at,delivery_id,inbox_id,raw_row)values($1,$2,'campaign','311','2026-01-02','Synthetic',now()+interval '1 minute','status-unit',$3,'{"status":"ACTIVE","effective_status":"PAUSED"}')`,[s.w,c,inbox]);const id=await s.conv('webhook-status',true);await touch(s,id,'211','status-touch');await s.login();
  const result=(await s.db.query<{result:CampaignQualityData}>(`select report_pancake_campaign_status_quality($1,'2026-01-01','2026-01-03') as result`,[s.w])).rows[0].result;
  expect(result.campaigns[0]).toMatchObject({meta_status:'ACTIVE',meta_effective_status:'PAUSED',meta_status_source:'webhook_snapshot'});expect(campaignQualityData(result)).not.toBeNull();
 });
 it('reads campaign spend once per day/account from webhook, not per conversation or child level, and never falls back to legacy status',async()=>{
  const s=await seed();const c=await meta(s,'9101','311',['211','212']);const other=await meta(s,'9102','311',['213']);await moneyRoute(s,c,'VND');await moneyRoute(s,other,'USD');
  await s.db.query(`update ad_entities set source_status='ACTIVE' where workspace_id=$1 and kind='campaign'`,[s.w]);const fact=await moneyFacts(s);
  await fact(c,'311','2026-01-01',100);await fact(c,'311','2026-01-02',20);await fact(c,'211','2026-01-02',9999,{},'ad','311');await fact(other,'311','2026-01-02',777);
  for(let i=0;i<3;i++){const cv=await s.conv(`money-${i}`,i===0);await touch(s,cv,'211',`money-touch-${i}`);if(i===0)await touch(s,cv,'212','second-ad');}await s.conv('money-no-ad',false);await s.login();
  const result=await webhookMetrics(s);const row=result.campaigns.find(r=>r.bucket==='campaign')!;expect(row).toMatchObject({account_id:'9101',campaign_id:'311',conversations:3,spend_received:120,spend_days:2,spend_rows:2,spend_expected_days:2,spend_currency:'VND',spend_source:'webhook',spend_issue:null,meta_status:null,meta_status_source:null});expect(result.campaigns.find(r=>r.bucket==='no_ad_id')).toMatchObject({spend_received:null,spend_days:0,spend_expected_days:0,spend_source:null,spend_issue:'unassigned'});
  await s.db.query(`select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)`);await expect(s.db.query(`select report_pancake_campaign_webhook_quality($1,'2026-01-01','2026-01-02')`,[s.w])).rejects.toThrow('forbidden');
 });
 it('preserves null/zero/currency/coverage, accepts explicit webhook status and hides disabled routes',async()=>{
  const s=await seed();const c=await meta(s,'9103','313',['215']);await moneyRoute(s,c,null);const fact=await moneyFacts(s);await fact(c,'313','2026-01-01',null,{status:'PAUSED'});const cv=await s.conv('nullable-money',true);await touch(s,cv,'215','nullable-money-touch');await s.login();
  expect((await webhookMetrics(s)).campaigns[0]).toMatchObject({spend_received:null,spend_currency:null,spend_days:0,spend_rows:1,spend_expected_days:2,spend_issue:'missing_values',meta_status:'PAUSED',meta_status_source:'webhook_snapshot'});
  await s.db.exec('reset role');await s.db.query(`update meta_webhook_facts set spend=0,generated_at=generated_at+interval '1 second' where connection_id=$1`,[c]);await s.login();expect((await webhookMetrics(s)).campaigns[0]).toMatchObject({spend_received:0,spend_days:1,spend_rows:1,spend_expected_days:2,spend_issue:null});
  await s.db.exec('reset role');await s.db.query(`update meta_webhook_routes set enabled=false where connection_id=$1`,[c]);await s.login();expect((await webhookMetrics(s)).campaigns[0]).toMatchObject({spend_received:null,spend_currency:null,spend_source:null,spend_issue:'source_unavailable',meta_status:null,meta_status_source:null});
 });
 it('refuses ambiguous normalized account profiles rather than pooling their currencies or spend',async()=>{
  const s=await seed();const c=await meta(s,'9101','311',['211']);const alias=await meta(s,'act_9101','312',['216']);await moneyRoute(s,c,'VND');await moneyRoute(s,alias,'USD');const cv=await s.conv('ambiguous-money',true);await touch(s,cv,'211','ambiguous-money-touch');await s.login();expect((await webhookMetrics(s)).campaigns[0]).toMatchObject({spend_received:null,spend_source:null,spend_issue:'ambiguous_account',meta_status:null});
 });
 it('inherits range, membership and anonymous protection from the base RPC',async()=>{
  const s=await seed();await s.login();await s.db.query(`select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)`);await expect(campaigns(s)).rejects.toThrow('forbidden');await s.db.exec('set role anon');await expect(campaigns(s)).rejects.toThrow();
 });
});

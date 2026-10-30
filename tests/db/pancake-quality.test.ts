import {PGlite} from '@electric-sql/pglite';
import {readdirSync,readFileSync} from 'node:fs';import{join}from'node:path';
import{afterEach,describe,expect,it}from'vitest';
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

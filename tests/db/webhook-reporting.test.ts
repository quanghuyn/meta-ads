import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const open: PGlite[] = [];
afterEach(async () => { for (const db of open.splice(0)) await db.close(); });
async function seed() {
  const db = new PGlite(); open.push(db);
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key default gen_random_uuid());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  const dir = join(process.cwd(), 'supabase/migrations');
  for (const f of readdirSync(dir).filter(f => f.endsWith('.sql') && !f.includes('schedule_sync')).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'));
  const w = (await db.query<{ id: string }>(`insert into workspaces(name) values ('synthetic') returning id`)).rows[0].id;
  const u = (await db.query<{ id: string }>(`insert into auth.users default values returning id`)).rows[0].id;
  await db.query(`insert into memberships(workspace_id,user_id,role) values ($1,$2,'marketing')`, [w,u]);
  for (const id of ['1492352028605038','1114645597047575']) {
    await db.query(`with c as (insert into source_connections(workspace_id,provider,source_id,state,name) values ($1,'meta',$2,'active','synthetic') returning *)
      insert into meta_webhook_routes(connection_id,workspace_id,report_level,enabled) select id,workspace_id,'campaign',true from c`, [w,id]);
  }
  let nextId = 0;
  const payload = (patch: Record<string, unknown> = {}) => ({ schema_version: 1, delivery_id: `synthetic-${++nextId}`, generated_at: '2026-01-02T10:00:00Z', level: 'campaign', range: { from: '2026-01-01', to: '2026-01-01' }, rows: [{ account_id: "'1492352028605038", campaign_id: "'123", campaign_name: 'synthetic campaign', date_start: "'2026-01-01", date_stop: '2026-01-01', spend: '1234,50', impressions: '100', clicks: null }], ...patch });
  const send = async (p: unknown) => {
    await db.exec('set role service_role');
    const { rows } = await db.query<{ id: string }>(`insert into meta_webhook_inbox(payload,payload_bytes) values ($1,100) returning id`, [JSON.stringify(p)]);
    return (await db.query<{ status: string; mapping_code: string }>(`select status,mapping_code from meta_webhook_inbox where id=$1`, [rows[0].id])).rows[0];
  };
  const facts = async () => (await db.query<{ spend: string; clicks: number | null; entity_id: string; raw_row: unknown }>('select * from meta_webhook_facts order by entity_id')).rows;
  const report = async () => {
    await db.exec('set role authenticated');
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [u]);
    return db.query<{ account_id: string; spend: string | null; source_date: string | null }>(`select * from report_meta_webhook($1,'2026-01-01','2026-01-01')`, [w]);
  };
  return { db,w,u,payload,send,facts,report };
}

describe('webhook normalization and report security', () => {
  it('normalizes quoted IDs/dates and decimal comma, preserves raw/null, replays idempotently', async () => {
    const s = await seed(); const p = s.payload();
    expect((await s.send(p)).mapping_code).toBe('processed');
    expect((await s.facts())[0]).toMatchObject({ entity_id:'123',spend:'1234.50',clicks:null,raw_row:p.rows[0] });
    expect((await s.send(p)).mapping_code).toBe('duplicate');
    expect(await s.facts()).toHaveLength(1);
    expect((await s.send({ ...p, rows:[{ ...p.rows[0], spend:'999' }] })).mapping_code).toBe('delivery_conflict');
    expect((await s.facts())[0].spend).toBe('1234.50');
  });
  it('new snapshot replaces rather than adds; stale delivery does not overwrite; ties fail closed', async () => {
    const s=await seed(); const p=s.payload(); await s.send(p);
    await s.send(s.payload({generated_at:'2026-01-03T10:00:00Z',rows:[{...p.rows[0],spend:'50'}]}));
    await s.send(s.payload({generated_at:'2026-01-01T10:00:00Z',rows:[{...p.rows[0],spend:'99'}]}));
    expect(Number((await s.facts())[0].spend)).toBe(50);
    expect((await s.send(s.payload({generated_at:'2026-01-03T10:00:00Z',rows:[{...p.rows[0],spend:'100'}]}))).mapping_code).toBe('snapshot_conflict');
  });
  it('excludes tests, invalid versions, missing/unknown account, range aggregates, invalid numbers atomically', async () => {
    const s=await seed(); const p=s.payload();
    for(const [patch,code] of [[{_test:true},'test_excluded'],[{_test:'false'},'test_excluded'],[{schema_version:2},'unsupported_schema'],[{rows:[{...p.rows[0],account_id:null}]},'missing_account'],[{rows:[{...p.rows[0],account_id:'1240787304172940'}]},'unmapped_account'],[{rows:[{...p.rows[0],date_stop:'2026-01-02'}]},'non_daily_row'],[{rows:[{...p.rows[0],date_stop:null}]},'non_daily_row'],[{rows:[{...p.rows[0],spend:'1.234,5'}]},'invalid_number'],[{rows:[{...p.rows[0],impressions:'1,5'}]},'invalid_number'],[{rows:[p.rows[0],p.rows[0]]},'duplicate_row_key']] as const) {
      expect((await s.send(s.payload(patch))).mapping_code).toBe(code);
      expect(await s.facts()).toHaveLength(0);
    }
    expect((await s.send(s.payload({rows:[p.rows[0],{...p.rows[0],campaign_id:'456',spend:'bad'}]}))).status).toBe('rejected');
    expect(await s.facts()).toHaveLength(0);
  });
  it('isolates accounts/levels, does not union sync facts; reports only explicitly selected level', async () => {
    const s=await seed();const p=s.payload();await s.send(p);
    await s.send(s.payload({rows:[{...p.rows[0],account_id:'1114645597047575',spend:'20'}]}));
    await s.send(s.payload({level:'ad',rows:[{...p.rows[0],ad_id:'789',spend:'1234,50'}]}));
    expect(await s.facts()).toHaveLength(3);
    const r=await s.report();expect(r.rows).toHaveLength(2);
    expect(r.rows.map(r=>Number(r.spend)).sort((a,b)=>a-b)).toEqual([20,1234.5]);
    await expect(s.db.query('select * from meta_webhook_facts')).rejects.toThrow();
    await expect(s.db.query('select * from meta_webhook_inbox')).rejects.toThrow();
    await expect(s.db.query('select * from meta_webhook_deliveries')).rejects.toThrow();
    await expect(s.db.query('select process_meta_webhook(gen_random_uuid())')).rejects.toThrow();
    await s.db.exec('set role anon');
    await expect(s.db.query(`select * from report_meta_webhook($1,'2026-01-01','2026-01-01')`,[s.w])).rejects.toThrow();
  });
  it('rejects outsiders/sales and foreign workspaces; exposes configured-but-empty account without zeros', async () => {
    const s=await seed();expect((await s.report()).rows.every(r=>r.spend===null && r.source_date===null)).toBe(true);
    await s.db.query(`select set_config('request.jwt.claim.sub',gen_random_uuid()::text,false)`);
    await expect(s.db.query(`select * from report_meta_webhook($1,'2026-01-01','2026-01-01')`,[s.w])).rejects.toThrow(/forbidden/);
    await s.db.exec('reset role');
    await s.db.query(`update memberships set role='sales' where user_id=$1`,[s.u]);
    await expect(s.report()).rejects.toThrow(/forbidden/);
  });
});

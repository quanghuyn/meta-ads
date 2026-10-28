import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Migration lịch chạy cần pg_cron/pg_net/vault của Supabase nên bỏ qua trên Postgres nhúng.
// Giả lập phần Supabase cung cấp sẵn (auth schema, role) để chạy migration trên Postgres nhúng.
const supabaseStub = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid());
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
`;

async function freshDb() {
  const db = new PGlite();
  await db.exec(supabaseStub);
  const dir = join(process.cwd(), "supabase/migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql") && !x.includes("schedule_sync")).sort()) {
    await db.exec(readFileSync(join(dir, f), "utf8"));
  }
  return db;
}

describe("migrations", () => {
  it("chạy sạch và mọi bảng public bật RLS", async () => {
    const db = await freshDb();
    const r = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`,
    );
    expect(r.rows).toEqual([]);
  });

  it("ràng buộc: một profile active, một attribution active, FK chéo workspace bị chặn", async () => {
    const db = await freshDb();
    const ws = async () =>
      (await db.query<{ id: string }>(`insert into workspaces(name) values ('w') returning id`)).rows[0].id;
    const w1 = await ws();
    const w2 = await ws();
    const c1 = (await db.query<{ id: string }>(
      `insert into source_connections(workspace_id,provider,source_id) values ($1,'meta','a') returning id`, [w1])).rows[0].id;
    await db.query(`insert into ad_query_profiles(workspace_id,connection_id,profile_hash,definition,active) values ($1,$2,'h1','{}',true)`, [w1, c1]);
    await expect(
      db.query(`insert into ad_query_profiles(workspace_id,connection_id,profile_hash,definition,active) values ($1,$2,'h2','{}',true)`, [w1, c1]),
    ).rejects.toThrow();
    await expect(
      db.query(`insert into ad_entities(workspace_id,connection_id,kind,source_id) values ($1,$2,'campaign','x')`, [w2, c1]),
    ).rejects.toThrow();
  });
});

describe("quyền truy cập", () => {
  it("marketing đọc được insights nhưng không đọc được hội thoại/đơn/credential_ref", async () => {
    const db = await freshDb();
    const w = (await db.query<{ id: string }>(`insert into workspaces(name) values ('w') returning id`)).rows[0].id;
    const u = (await db.query<{ id: string }>(`insert into auth.users default values returning id`)).rows[0].id;
    await db.query(`insert into memberships(workspace_id,user_id,role) values ($1,$2,'marketing')`, [w, u]);
    await db.query(`insert into source_connections(workspace_id,provider,source_id,credential_ref) values ($1,'meta','a','SECRET_X')`, [w]);
    await db.exec(`set role authenticated`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [u]);
    expect((await db.query(`select * from workspaces`)).rows).toHaveLength(1);
    expect((await db.query(`select id from source_connections`)).rows).toHaveLength(1);
    await expect(db.query(`select credential_ref from source_connections`)).rejects.toThrow();
    await expect(db.query(`select * from conversations`)).rejects.toThrow();
    await expect(db.query(`select * from orders`)).rejects.toThrow();
  });
});

describe("report_daily", () => {
  async function seed() {
    const db = await freshDb();
    const w = (await db.query<{ id: string }>(`insert into workspaces(name) values ('w') returning id`)).rows[0].id;
    const q = async <T,>(sql: string, p: unknown[]) => (await db.query<T & { id: string }>(sql, p)).rows[0];
    const meta = await q(`insert into source_connections(workspace_id,provider,source_id,state) values ($1,'meta','a','active') returning id`, [w]);
    const pos = await q(`insert into source_connections(workspace_id,provider,source_id,state) values ($1,'pos','p','active') returning id`, [w]);
    const inbox = await q(`insert into source_connections(workspace_id,provider,source_id,state) values ($1,'inbox','i','active') returning id`, [w]);
    await db.query(`insert into ad_query_profiles(workspace_id,connection_id,profile_hash,definition,active) values ($1,$2,'h','{}',true)`, [w, meta.id]);
    // 2 chiến dịch cùng ngày: tổng chi tiêu phải là tổng, không bị nhân qua join với đơn/hội thoại
    for (const [sid, spend] of [["c1", 100], ["c2", 50]] as const) {
      const e = await q(`insert into ad_entities(workspace_id,connection_id,kind,source_id) values ($1,$2,'campaign',$3) returning id`, [w, meta.id, sid]);
      await db.query(`insert into ad_insights_daily(workspace_id,connection_id,ad_entity_id,source_date,query_profile_hash,spend,impressions,clicks_all,source_timezone,currency) values ($1,$2,$3,'2026-10-27','h',$4,1000,10,'Asia/Ho_Chi_Minh','VND')`, [w, meta.id, e.id, spend]);
    }
    for (const [sid, amount, included] of [["o1", 30, true], ["o2", 20, true], ["o3", 99, false]] as const) {
      const o = await q(`insert into orders(workspace_id,connection_id,source_id,order_created_at,source_status,currency) values ($1,$2,$3,now(),'1','VND') returning id`, [w, pos.id, sid]);
      await db.query(`insert into order_total_sale_facts(workspace_id,order_id,contract_version,source_fact_key,recognition_date,included,amount,currency) values ($1,$2,1,'order','2026-10-27',$3,$4,'VND')`, [w, o.id, included, amount]);
    }
    // 17:30 UTC 26/10 = 00:30 VN 27/10
    const mk = async (sid: string, phone: boolean, tag?: string) => {
      const c = await q(`insert into conversations(workspace_id,connection_id,source_id,source_inserted_at,has_phone) values ($1,$2,$3,'2026-10-26T17:30:00Z',$4) returning id`, [w, inbox.id, sid, phone]);
      if (tag) await db.query(`insert into conversation_evidence(workspace_id,conversation_id,kind,dedupe_key,value,observed_at) values ($1,$2,'tag',$3,$4,now())`, [w, c.id, `tag:${tag}`, JSON.stringify({ text: tag })]);
    };
    await mk("v1", true, "XTS"); await mk("v2", true, "Trùng khách"); await mk("v3", false, "RLCD"); await mk("v4", true, "XTS + RLCD");
    return { db, w };
  }

  it("gộp từng nguồn theo ngày VN, không nhân spend, qualified = nhu cầu + SĐT", async () => {
    const { db, w } = await seed();
    await db.exec(`set role service_role`);
    const r = await db.query<Record<string, string>>(`select * from report_daily($1,'2026-10-26','2026-10-27')`, [w]);
    expect(r.rows).toHaveLength(2);
    const d27 = r.rows[1];
    expect(Number(d27.spend)).toBe(150);
    expect(Number(d27.total_sale)).toBe(50);
    expect(Number(d27.orders)).toBe(2);
    expect(Number(d27.conversations)).toBe(4);
    expect(Number(d27.with_phone)).toBe(3);
    expect(Number(d27.qualified)).toBe(2);
    expect(Number(r.rows[0].spend)).toBe(0);
  });

  it("đối soát chiến dịch: đơn gán theo ad_id, đơn không gán hiện riêng, tổng không đổi", async () => {
    const { db, w } = await seed();
    const meta = (await db.query<{ id: string }>(`select id from source_connections where provider='meta'`)).rows[0].id;
    const pos = (await db.query<{ id: string }>(`select id from source_connections where provider='pos'`)).rows[0].id;
    const c1 = (await db.query<{ id: string }>(`select id from ad_entities where source_id='c1'`)).rows[0].id;
    await db.query(`insert into ad_entities(workspace_id,connection_id,kind,source_id,parent_id) values ($1,$2,'ad','ad1',$3)`, [w, meta, c1]);
    const upd = async (sid: string, ad: string | null) => db.query(`update orders set source_ad_id=$1 where source_id=$2`, [ad, sid]);
    await upd("o1", "ad1"); await upd("o2", "adX"); // o3 không tính Total Sale
    await db.query(`insert into orders(workspace_id,connection_id,source_id,order_created_at,source_status,currency) values ($1,$2,'o4',now(),'1','VND')`, [w, pos]);
    const o4 = (await db.query<{ id: string }>(`select id from orders where source_id='o4'`)).rows[0].id;
    await db.query(`insert into order_total_sale_facts(workspace_id,order_id,contract_version,source_fact_key,recognition_date,included,amount,currency) values ($1,$2,1,'order','2026-10-27',true,7,'VND')`, [w, o4]);
    await db.exec(`set role service_role`);
    const r = await db.query<{ bucket: string; campaign_source_id: string | null; spend: string; orders: string; total_sale: string }>(
      `select * from report_campaign_daily($1,'2026-10-27','2026-10-27')`, [w]);
    const by = (b: string, c?: string) => r.rows.find((x) => x.bucket === b && (c === undefined || x.campaign_source_id === c))!;
    expect(Number(by("campaign", "c1").spend)).toBe(100);
    expect(Number(by("campaign", "c1").total_sale)).toBe(30);
    expect(Number(by("campaign", "c2").spend)).toBe(50);
    expect(Number(by("campaign", "c2").orders)).toBe(0);
    expect(Number(by("ad_unknown").total_sale)).toBe(20);
    expect(Number(by("no_ad_id").total_sale)).toBe(7);
    expect(r.rows.reduce((a, x) => a + Number(x.total_sale), 0)).toBe(57);
    expect(r.rows.reduce((a, x) => a + Number(x.spend), 0)).toBe(150);
  });

  it("chặn người ngoài workspace và vai trò sales", async () => {
    const { db, w } = await seed();
    const u = (await db.query<{ id: string }>(`insert into auth.users default values returning id`)).rows[0].id;
    await db.exec(`set role authenticated`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [u]);
    await expect(db.query(`select * from report_daily($1,'2026-10-27','2026-10-27')`, [w])).rejects.toThrow(/forbidden/);
  });
});

import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
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

// Worker Meta chi-doc qua MCP cua ADS Noti: chi tieu theo chien dich va ngay vao Supabase.
// Goi: POST /functions/v1/sync-meta?days=2&offset=0&account=<id> voi header x-worker-secret hoac x-cron-token.
// offset > 0 lui cua so ve qua khu: lay `days` ngay ket thuc `offset` ngay truoc hom nay.
// Secrets: WORKER_TRIGGER_SECRET, ADSNOTI_MCP_URL (dia chi co khoa, khong bao gio log).
import { createClient } from "jsr:@supabase/supabase-js@2";

const ACCOUNTS = ["1492352028605038", "1114645597047575"];
const PROFILE_HASH = "campaign-daily-v1";
const FIELDS = "campaign_id,campaign_name,spend,impressions,clicks";
const VN_OFFSET = 7 * 3600_000;

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// deno-lint-ignore no-explicit-any
async function authorized(req: Request, db: any) {
  const secret = Deno.env.get("WORKER_TRIGGER_SECRET");
  const given = req.headers.get("x-worker-secret");
  if (secret && given && safeEqual(given, secret)) return true;
  const token = req.headers.get("x-cron-token");
  if (!token) return false;
  const { data } = await db.rpc("verify_cron_token", { token });
  return data === true;
}

class SourceError extends Error {
  constructor(readonly code: string, msg: string) { super(msg); }
}

async function rpc(url: string, body: Record<string, unknown>, session?: string) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(session ? { "mcp-session-id": session } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SourceError("SOURCE_UNAVAILABLE", "khong ket noi duoc MCP ADS Noti");
  }
  if (res.status === 401 || res.status === 403) throw new SourceError("AUTH_EXPIRED", `MCP ${res.status}`);
  if (!res.ok) throw new SourceError("SOURCE_UNAVAILABLE", `MCP ${res.status}`);
  const text = await res.text();
  let msg: { result?: unknown; error?: { message?: string } } | undefined;
  if ((res.headers.get("content-type") ?? "").includes("event-stream")) {
    for (const line of text.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try { const m = JSON.parse(line.slice(5)); if (m.id === body.id) msg = m; } catch { /* bo qua */ }
    }
  } else if (text) {
    try { msg = JSON.parse(text); } catch { /* xu ly ben duoi */ }
  }
  if (!("id" in body)) return { session: res.headers.get("mcp-session-id") ?? session, result: undefined };
  if (!msg) throw new SourceError("SCHEMA_CHANGED", "phan hoi MCP khong doc duoc");
  if (msg.error) throw new SourceError("SOURCE_UNAVAILABLE", `MCP loi: ${String(msg.error.message).slice(0, 120)}`);
  return { session: res.headers.get("mcp-session-id") ?? session, result: msg.result };
}

async function openSession(url: string) {
  const init = await rpc(url, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "meta-ads-dashboard-sync", version: "1" } } });
  await rpc(url, { jsonrpc: "2.0", method: "notifications/initialized" }, init.session).catch(() => undefined);
  return init.session;
}

type Row = { campaign_id?: string; campaign_name?: string; spend?: string; impressions?: string; clicks?: string; status?: string };

// Thieu hoac sai so do thi khong duoc thay bang 0: dong do bi bo qua va bao PARTIAL.
const measure = (v: unknown) => v !== undefined && v !== null && v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0;
const hasMeasures = (r: Row) => measure(r.spend) && measure(r.impressions) && measure(r.clicks);

// Ma credential cua khoa API khac voi ket noi trong chat nen hoi ADS Noti thay vi ghi cung.
async function credentialFor(url: string, session: string | undefined, account: string): Promise<string> {
  let visible = "";
  // Danh sach tai khoan doi khi tra rong o lan goi dau nen thu lai vai lan.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { result } = await rpc(url, { jsonrpc: "2.0", id: 50 + attempt, method: "tools/call", params: { name: "meta_get_ad_accounts", arguments: {} } }, session);
    const text = (result as { content?: { text?: string }[] })?.content?.[0]?.text;
    let body: { accounts?: { credential_id?: string; ad_accounts?: { account_id?: string }[] }[] };
    try { body = JSON.parse(text ?? ""); } catch { throw new SourceError("SCHEMA_CHANGED", "meta_get_ad_accounts khong doc duoc"); }
    const hit = body.accounts?.find((c) => c.ad_accounts?.some((a) => a.account_id === account));
    if (hit?.credential_id) return hit.credential_id;
    visible = (body.accounts ?? []).flatMap((c) => (c.ad_accounts ?? []).map((a) => a.account_id)).join(",");
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new SourceError("NOT_CONFIGURED", `Khoa ADS Noti khong thay tai khoan ${account}; thay: ${visible}`.slice(0, 600));
}

async function insights(url: string, session: string | undefined, credential: string, account: string, date: string): Promise<Row[]> {
  const { result } = await rpc(url, {
    jsonrpc: "2.0", id: 100 + Math.floor(Math.random() * 1e6), method: "tools/call",
    params: { name: "meta_get_insights", arguments: { credential_id: credential, ad_account_ids: account, date_from: date, date_to: date, level: "campaign", metrics: FIELDS } },
  }, session);
  const r = result as { isError?: boolean; content?: { text?: string }[] };
  const text = r?.content?.[0]?.text;
  if (!text) throw new SourceError("SCHEMA_CHANGED", "ket qua meta_get_insights trong");
  let body: { success?: boolean; ad_accounts?: Record<string, { success?: boolean; data?: Row[]; paging?: { next?: string } }>; error?: string };
  try { body = JSON.parse(text); } catch { throw new SourceError("SOURCE_UNAVAILABLE", `meta_get_insights: ${text.slice(0, 120)}`); }
  if (r.isError || body.error) throw new SourceError("SOURCE_UNAVAILABLE", `meta_get_insights: ${String(body.error ?? text).slice(0, 160)}`);
  const acc = body.ad_accounts?.[account];
  if (!acc?.success || !Array.isArray(acc.data)) throw new SourceError("SCHEMA_CHANGED", `thieu data cho ${account}`);
  if (acc.paging && (acc.paging as { next?: string }).next) throw new SourceError("PARTIAL", `ket qua ${account} ${date} con trang sau`);
  return acc.data;
}

// Quang cao -> chien dich (cap ad), dung de gan don va hoi thoai ve chien dich. Khong luu so lieu cap ad.
async function adMapping(url: string, session: string | undefined, credential: string, account: string, date: string): Promise<{ ad_id?: string; campaign_id?: string }[]> {
  const { result } = await rpc(url, {
    jsonrpc: "2.0", id: 100 + Math.floor(Math.random() * 1e6), method: "tools/call",
    params: { name: "meta_get_insights", arguments: { credential_id: credential, ad_account_ids: account, date_from: date, date_to: date, level: "ad", metrics: "ad_id,campaign_id" } },
  }, session);
  const text = (result as { content?: { text?: string }[] })?.content?.[0]?.text ?? "";
  let body: { ad_accounts?: Record<string, { success?: boolean; data?: { ad_id?: string; campaign_id?: string }[] }> };
  try { body = JSON.parse(text); } catch { throw new SourceError("SOURCE_UNAVAILABLE", `meta ad-level: ${text.slice(0, 120)}`); }
  const acc = body.ad_accounts?.[account];
  if (!acc?.success || !Array.isArray(acc.data)) throw new SourceError("SCHEMA_CHANGED", `thieu ad-level cho ${account}`);
  return acc.data;
}

function dates(days: number, offset = 0) {
  const endDay = new Date(Date.now() + VN_OFFSET - offset * 86400_000);
  return Array.from({ length: days }, (_, i) => new Date(endDay.getTime() - i * 86400_000).toISOString().slice(0, 10)).reverse();
}

// deno-lint-ignore no-explicit-any
type Db = any;

async function syncAccount(db: Db, url: string, session: string | undefined, account: string, days: string[]) {
  const { data: conn } = await db.from("source_connections").select("id,workspace_id").eq("provider", "meta").eq("source_id", account).maybeSingle();
  if (!conn) throw new SourceError("NOT_CONFIGURED", `Chua co ket noi meta ${account}`);
  let rows = 0;
  let skipped = 0;
  const credential = await credentialFor(url, session, account);
  // Goi MCP song song theo cum ngay de kip gioi han thoi gian cua Edge Function, ghi DB tuan tu.
  for (let i = 0; i < days.length; i += 4) {
    const chunk = days.slice(i, i + 4);
    const fetched = await Promise.all(chunk.map(async (date) => {
      const all = (await insights(url, session, credential, account, date)).filter((r) => r.campaign_id);
      const data = all.filter(hasMeasures);
      return { date, data, dropped: all.length - data.length, ads: await adMapping(url, session, credential, account, date) };
    }));
    for (const { date, data, dropped, ads: rawAds } of fetched) {
      skipped += dropped;
      if (data.length === 0) continue;
      const ents = await db.from("ad_entities").upsert(
        data.map((r) => ({ workspace_id: conn.workspace_id, connection_id: conn.id, kind: "campaign", source_id: r.campaign_id, name: r.campaign_name ?? null, source_status: r.status ?? null })),
        { onConflict: "workspace_id,connection_id,kind,source_id" },
      ).select("id,source_id");
      if (ents.error) throw new Error(`ad_entities: ${ents.error.message}`);
      const idOf = new Map((ents.data as { id: string; source_id: string }[]).map((e) => [e.source_id, e.id]));
      const ins = await db.from("ad_insights_daily").upsert(
        data.map((r) => ({ workspace_id: conn.workspace_id, connection_id: conn.id, ad_entity_id: idOf.get(r.campaign_id!), source_date: date, query_profile_hash: PROFILE_HASH, spend: r.spend, impressions: Number(r.impressions), clicks_all: Number(r.clicks), source_timezone: "Asia/Ho_Chi_Minh", currency: "VND", synced_at: new Date().toISOString() })),
        { onConflict: "workspace_id,connection_id,ad_entity_id,source_date,query_profile_hash" },
      );
      if (ins.error) throw new Error(`ad_insights_daily: ${ins.error.message}`);
      rows += data.length;

      const ads = rawAds.filter((a) => a.ad_id && a.campaign_id && idOf.has(a.campaign_id));
      const covered = new Set(ads.map((a) => a.campaign_id));
      const missing = data.filter((r) => !covered.has(r.campaign_id!)).length;
      if (ads.length) {
        const up = await db.from("ad_entities").upsert(
          ads.map((a) => ({ workspace_id: conn.workspace_id, connection_id: conn.id, kind: "ad", source_id: a.ad_id, parent_id: idOf.get(a.campaign_id!) })),
          { onConflict: "workspace_id,connection_id,kind,source_id" },
        );
        if (up.error) throw new Error(`ad_entities(ad): ${up.error.message}`);
      }
      if (missing > 0) throw new SourceError("PARTIAL", `${account} ${date}: ${missing} chien dich chua co quang cao o cap ad`);
    }
  }
  if (skipped > 0) throw new SourceError("PARTIAL", `${account}: ${skipped} dong thieu spend/impressions/clicks hop le, da bo qua; checkpoint khong duoc ghi`);
  const now = new Date().toISOString();
  await db.from("sync_checkpoints").upsert({ workspace_id: conn.workspace_id, connection_id: conn.id, stream: "insights", completed_through: now, updated_at: now }, { onConflict: "workspace_id,connection_id,stream" });
  await db.from("source_connections").update({ last_success_at: now, state: "active" }).eq("id", conn.id);
  return rows;
}

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  if (!(await authorized(req, db))) return json({ error: "unauthorized" }, 401);
  const url = Deno.env.get("ADSNOTI_MCP_URL");
  if (!url) return json({ ok: false, code: "NOT_CONFIGURED", message: "Thieu secret ADSNOTI_MCP_URL" }, 500);
  const params = new URL(req.url).searchParams;
  const offset = Math.min(Math.max(Number(params.get("offset") ?? 0) || 0, 0), 60);
  const days = dates(Math.min(Math.max(Number(params.get("days") ?? 2) || 2, 1), 14), offset);
  try {
    const session = await openSession(url);
    const out: Record<string, number | string> = {};
    const only = params.get("account");
    for (const a of ACCOUNTS.filter((x) => !only || x === only)) {
      try { out[a] = await syncAccount(db, url, session, a, days); }
      catch (e) { out[a] = `${e instanceof SourceError ? e.code : "ERROR"}: ${String((e as Error).message).slice(0, 600)}`; }
    }
    const failed = Object.values(out).some((v) => typeof v === "string");
    return json({ ok: !failed, days: [days[0], days[days.length - 1]], accounts: out }, failed ? 500 : 200);
  } catch (e) {
    const code = e instanceof SourceError ? e.code : "ERROR";
    return json({ ok: false, code, message: String((e as Error).message).slice(0, 300) }, 500);
  }
});

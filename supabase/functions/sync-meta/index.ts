// Worker Meta chỉ-đọc qua MCP của ADS Noti: chi tiêu theo chiến dịch và ngày vào Supabase.
// Gọi: POST /functions/v1/sync-meta?days=2 với header x-worker-secret.
// Secrets: WORKER_TRIGGER_SECRET, ADSNOTI_MCP_URL (địa chỉ có khóa, không bao giờ log).
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

// Chấp nhận secret của người vận hành hoặc token do database sinh (lịch pg_cron).
async function authorized(req: Request, db: { rpc: (f: string, a: unknown) => PromiseLike<{ data: unknown }> }) {
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

// Gọi JSON-RPC tới MCP (streamable HTTP). Kết quả có thể là JSON thường hoặc SSE.
async function rpc(url: string, body: Record<string, unknown>, session?: string) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(session ? { "mcp-session-id": session } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SourceError("SOURCE_UNAVAILABLE", "không kết nối được MCP ADS Noti");
  }
  if (res.status === 401 || res.status === 403) throw new SourceError("AUTH_EXPIRED", `MCP ${res.status}`);
  if (!res.ok) throw new SourceError("SOURCE_UNAVAILABLE", `MCP ${res.status}`);
  const text = await res.text();
  let msg: { result?: unknown; error?: { message?: string } } | undefined;
  if ((res.headers.get("content-type") ?? "").includes("event-stream")) {
    for (const line of text.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try { const m = JSON.parse(line.slice(5)); if (m.id === body.id) msg = m; } catch { /* bỏ qua dòng lỗi */ }
    }
  } else if (text) {
    try { msg = JSON.parse(text); } catch { /* xử lý bên dưới */ }
  }
  if (!("id" in body)) return { session: res.headers.get("mcp-session-id") ?? session, result: undefined };
  if (!msg) throw new SourceError("SCHEMA_CHANGED", "phản hồi MCP không đọc được");
  if (msg.error) throw new SourceError("SOURCE_UNAVAILABLE", `MCP lỗi: ${String(msg.error.message).slice(0, 120)}`);
  return { session: res.headers.get("mcp-session-id") ?? session, result: msg.result };
}

async function openSession(url: string) {
  const init = await rpc(url, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "meta-ads-dashboard-sync", version: "1" } } });
  await rpc(url, { jsonrpc: "2.0", method: "notifications/initialized" }, init.session).catch(() => undefined);
  return init.session;
}

type Row = { campaign_id?: string; campaign_name?: string; spend?: string; impressions?: string; clicks?: string; status?: string };

// Mã credential của khóa API khác với kết nối trong chat nên hỏi ADS Noti thay vì ghi cứng.
async function credentialFor(url: string, session: string | undefined, account: string): Promise<string> {
  let visible = "";
  // Danh sách tài khoản đôi khi trả rỗng ở lần gọi đầu nên thử lại vài lần.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { result } = await rpc(url, { jsonrpc: "2.0", id: 50 + attempt, method: "tools/call", params: { name: "meta_get_ad_accounts", arguments: {} } }, session);
    const text = (result as { content?: { text?: string }[] })?.content?.[0]?.text;
    let body: { accounts?: { credential_id?: string; ad_accounts?: { account_id?: string }[] }[] };
    try { body = JSON.parse(text ?? ""); } catch { throw new SourceError("SCHEMA_CHANGED", "meta_get_ad_accounts không đọc được"); }
    const hit = body.accounts?.find((c) => c.ad_accounts?.some((a) => a.account_id === account));
    if (hit?.credential_id) return hit.credential_id;
    visible = (body.accounts ?? []).flatMap((c) => (c.ad_accounts ?? []).map((a) => a.account_id)).join(",");
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new SourceError("NOT_CONFIGURED", `Khóa ADS Noti không thấy tài khoản ${account}; thấy: ${visible}`.slice(0, 600));
}

async function insights(url: string, session: string | undefined, credential: string, account: string, date: string): Promise<Row[]> {
  const { result } = await rpc(url, {
    jsonrpc: "2.0", id: 100 + Math.floor(Math.random() * 1e6), method: "tools/call",
    params: { name: "meta_get_insights", arguments: { credential_id: credential, ad_account_ids: account, date_from: date, date_to: date, level: "campaign", metrics: FIELDS } },
  }, session);
  const r = result as { isError?: boolean; content?: { text?: string }[] };
  const text = r?.content?.[0]?.text;
  if (!text) throw new SourceError("SCHEMA_CHANGED", "kết quả meta_get_insights trống");
  let body: { success?: boolean; ad_accounts?: Record<string, { success?: boolean; data?: Row[]; paging?: { next?: string } }>; error?: string };
  try { body = JSON.parse(text); } catch { throw new SourceError("SOURCE_UNAVAILABLE", `meta_get_insights: ${text.slice(0, 120)}`); }
  if (r.isError || body.error) throw new SourceError("SOURCE_UNAVAILABLE", `meta_get_insights: ${String(body.error ?? text).slice(0, 160)}`);
  const acc = body.ad_accounts?.[account];
  if (!acc?.success || !Array.isArray(acc.data)) throw new SourceError("SCHEMA_CHANGED", `thiếu data cho ${account}`);
  if (acc.paging && (acc.paging as { next?: string }).next) throw new SourceError("PARTIAL", `kết quả ${account} ${date} còn trang sau`);
  return acc.data;
}

const measure = (v: unknown) => v !== undefined && v !== null && v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0;
const hasMeasures = (r: Row) => measure(r.spend) && measure(r.impressions) && measure(r.clicks);

function dates(days: number) {
  const todayVn = new Date(Date.now() + VN_OFFSET);
  return Array.from({ length: days }, (_, i) => new Date(todayVn.getTime() - i * 86400_000).toISOString().slice(0, 10)).reverse();
}

// deno-lint-ignore no-explicit-any
type Db = any;

async function syncAccount(db: Db, url: string, session: string | undefined, account: string, days: string[]) {
  const { data: conn } = await db.from("source_connections").select("id,workspace_id").eq("provider", "meta").eq("source_id", account).maybeSingle();
  if (!conn) throw new SourceError("NOT_CONFIGURED", `Chưa có kết nối meta ${account}`);
  let rows = 0;
  let skipped = 0;
  const credential = await credentialFor(url, session, account);
  for (const date of days) {
    const all = (await insights(url, session, credential, account, date)).filter((r) => r.campaign_id);
    // Thiếu hoặc sai số đo thì không ghi 0 thay thế: bỏ dòng đó và báo PARTIAL sau khi lưu các dòng hợp lệ.
    const data = all.filter(hasMeasures);
    skipped += all.length - data.length;
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
  }
  if (skipped > 0) throw new SourceError("PARTIAL", `${account}: ${skipped} dòng thiếu spend/impressions/clicks hợp lệ, đã bỏ qua; checkpoint không được ghi`);
  const now = new Date().toISOString();
  await db.from("sync_checkpoints").upsert({ workspace_id: conn.workspace_id, connection_id: conn.id, stream: "insights", completed_through: now, updated_at: now }, { onConflict: "workspace_id,connection_id,stream" });
  await db.from("source_connections").update({ last_success_at: now, state: "active" }).eq("id", conn.id);
  return rows;
}

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  if (!(await authorized(req, db))) return json({ error: "unauthorized" }, 401);
  const url = Deno.env.get("ADSNOTI_MCP_URL");
  if (!url) return json({ ok: false, code: "NOT_CONFIGURED", message: "Thiếu secret ADSNOTI_MCP_URL" }, 500);
  const days = dates(Math.min(Math.max(Number(new URL(req.url).searchParams.get("days") ?? 2) || 2, 1), 14));
  try {
    const session = await openSession(url);
    const out: Record<string, number | string> = {};
    for (const a of ACCOUNTS) {
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

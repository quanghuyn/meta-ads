// Worker đồng bộ chỉ-đọc: Pancake Chat (hội thoại) và Pancake POS (đơn) vào Supabase.
// Gọi: POST /functions/v1/sync?job=pancake|pos&days=2 với header x-worker-secret.
// Secrets: WORKER_TRIGGER_SECRET, PANCAKE_PAGE_TOKEN, POS_API_KEY (SUPABASE_URL và SERVICE_ROLE_KEY có sẵn).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { normalizeConversation, SchemaChanged, type NormalizedConversation } from "../_shared/domain/pancake-conversation.ts";
import { normalizeOrder, type NormalizedOrder } from "../_shared/domain/pos-order.ts";

const PAGE_ID = "196059750263125";
const SHOP_ID = "1546758";
const CONTRACT_VERSION = 1;
const VN_OFFSET = 7 * 3600;

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

// URL có token trong query nên không bao giờ đưa URL vào log hay thông báo lỗi.
async function getJson(url: string, label: string) {
  const res = await fetch(url);
  if (res.status === 401 || res.status === 403) throw new SourceError("AUTH_EXPIRED", `${label}: ${res.status}`);
  if (res.status === 429) throw new SourceError("RATE_LIMITED", `${label}: 429`);
  if (!res.ok) throw new SourceError("SOURCE_UNAVAILABLE", `${label}: ${res.status}`);
  return await res.json();
}

function windowOf(days: number) {
  const now = Math.floor(Date.now() / 1000);
  const todayVn = Math.floor((now + VN_OFFSET) / 86400) * 86400 - VN_OFFSET;
  return { since: todayVn - (days - 1) * 86400, until: now };
}

type Db = ReturnType<typeof createClient>;

async function connection(db: Db, provider: string, sourceId: string) {
  const { data, error } = await db.from("source_connections").select("id,workspace_id").eq("provider", provider).eq("source_id", sourceId).maybeSingle();
  if (error || !data) throw new SourceError("NOT_CONFIGURED", `Chưa có kết nối ${provider} ${sourceId} trong source_connections`);
  return data as { id: string; workspace_id: string };
}

async function finish(db: Db, conn: { id: string; workspace_id: string }, stream: string) {
  const now = new Date().toISOString();
  await db.from("sync_checkpoints").upsert({ workspace_id: conn.workspace_id, connection_id: conn.id, stream, completed_through: now, updated_at: now }, { onConflict: "workspace_id,connection_id,stream" });
  await db.from("source_connections").update({ last_success_at: now, state: "active" }).eq("id", conn.id);
}

async function saveConversations(db: Db, conn: { id: string; workspace_id: string }, items: NormalizedConversation[]) {
  if (items.length === 0) return;
  const observed = new Date().toISOString();
  const { data, error } = await db.from("conversations").upsert(
    items.map((c) => ({ workspace_id: conn.workspace_id, connection_id: conn.id, source_id: c.sourceId, source_inserted_at: c.sourceInsertedAt, source_updated_at: c.sourceUpdatedAt, has_phone: c.hasPhone })),
    { onConflict: "workspace_id,connection_id,source_id" },
  ).select("id,source_id");
  if (error) throw new Error(`conversations: ${error.message}`);
  const idOf = new Map((data as { id: string; source_id: string }[]).map((r) => [r.source_id, r.id]));
  const ids = [...idOf.values()];

  // Nhãn là ảnh chụp hiện tại: thay toàn bộ nhãn nguồn của các hội thoại trong lô.
  const del = await db.from("conversation_evidence").delete().in("conversation_id", ids).eq("kind", "tag").eq("origin", "source");
  if (del.error) throw new Error(`evidence delete: ${del.error.message}`);
  const evidence = items.flatMap((c) => c.tags.map((t) => ({ workspace_id: conn.workspace_id, conversation_id: idOf.get(c.sourceId)!, kind: "tag", dedupe_key: `tag:${t}`, value: { text: t }, observed_at: observed })));
  if (evidence.length) {
    const ins = await db.from("conversation_evidence").insert(evidence);
    if (ins.error) throw new Error(`evidence insert: ${ins.error.message}`);
  }
  const touches = items.flatMap((c) => c.touches.map((t) => ({ workspace_id: conn.workspace_id, conversation_id: idOf.get(c.sourceId)!, source_ad_id: t.sourceAdId, touched_at: t.touchedAt, observed_at: observed, source_event_key: t.eventKey })));
  if (touches.length) {
    const up = await db.from("ad_touches").upsert(touches, { onConflict: "workspace_id,source_event_key" });
    if (up.error) throw new Error(`ad_touches: ${up.error.message}`);
  }
}

async function runPancake(db: Db, days: number) {
  const token = Deno.env.get("PANCAKE_PAGE_TOKEN");
  if (!token) throw new SourceError("NOT_CONFIGURED", "Thiếu secret PANCAKE_PAGE_TOKEN");
  const conn = await connection(db, "inbox", PAGE_ID);
  const { since, until } = windowOf(days);
  let last: string | undefined;
  let total = 0;
  let complete = false;
  for (let page = 0; page < 60; page++) {
    const q = new URLSearchParams({ type: "INBOX", since: String(since), until: String(until), order_by: "inserted_at", fields: "id,inserted_at,updated_at,has_phone,tags,ads,ad_ids", page_access_token: token });
    if (last) q.set("last_conversation_id", last);
    const body = await getJson(`https://pages.fm/api/public_api/v2/pages/${PAGE_ID}/conversations?${q}`, "pancake conversations");
    const list = body?.conversations;
    if (!Array.isArray(list)) throw new SchemaChanged("conversations[]");
    // Kết thúc khi nguồn trả trang rỗng, không giả định kích thước trang.
    if (list.length === 0) { complete = true; break; }
    const items = list.map((r: unknown) => normalizeConversation(r as never));
    await saveConversations(db, conn, items);
    total += items.length;
    last = items[items.length - 1].sourceId;
  }
  if (!complete) throw new SourceError("PARTIAL", `pancake conversations còn trang sau ${total} hội thoại; checkpoint không được ghi`);
  await finish(db, conn, "conversations");
  return { conversations: total, since, until };
}

async function saveOrders(db: Db, conn: { id: string; workspace_id: string }, items: NormalizedOrder[]) {
  if (items.length === 0) return;
  const { data, error } = await db.from("orders").upsert(
    items.map((o) => ({ workspace_id: conn.workspace_id, connection_id: conn.id, source_id: o.sourceId, source_conversation_id: o.conversationId, source_ad_id: o.adId, order_created_at: o.createdAt, source_updated_at: o.updatedAt, source_status: o.status, currency: "VND", amount_components: { total_price_after_sub_discount: o.amount } })),
    { onConflict: "workspace_id,connection_id,source_id" },
  ).select("id,source_id");
  if (error) throw new Error(`orders: ${error.message}`);
  const idOf = new Map((data as { id: string; source_id: string }[]).map((r) => [r.source_id, r.id]));
  const facts = items.map((o) => ({ workspace_id: conn.workspace_id, order_id: idOf.get(o.sourceId)!, contract_version: CONTRACT_VERSION, source_fact_key: "order", recognition_date: o.recognitionDate, included: o.included, amount: o.amount, currency: "VND", reason: o.included ? null : `status ${o.status} không thuộc tập tính Total Sale` }));
  const up = await db.from("order_total_sale_facts").upsert(facts, { onConflict: "workspace_id,order_id,contract_version,source_fact_key" });
  if (up.error) throw new Error(`sale facts: ${up.error.message}`);
}

async function runPos(db: Db, days: number) {
  const key = Deno.env.get("POS_API_KEY");
  if (!key) throw new SourceError("NOT_CONFIGURED", "Thiếu secret POS_API_KEY");
  const conn = await connection(db, "pos", SHOP_ID);
  const { since, until } = windowOf(days);
  // Lọc nguồn đơn ở phía worker (page_id + order_sources=-1) vì cách truyền mảng lồng trên URL chưa được docs xác nhận.
  let seen = 0;
  let total = 0;
  let totalEntries = 0;
  let complete = false;
  for (let page = 1; page <= 100; page++) {
    const q = new URLSearchParams({ api_key: key, page_size: "100", page_number: String(page), update_status: "inserted_at", start_date_time: String(since), end_date_time: String(until) });
    const body = await getJson(`https://pos.pages.fm/api/v1/shops/${SHOP_ID}/orders?${q}`, "pos orders");
    if (!Array.isArray(body?.data)) throw new SchemaChanged("orders.data[]");
    totalEntries = Number(body.total_entries ?? totalEntries);
    seen += body.data.length;
    const mine = body.data.filter((r: { page_id?: unknown; order_sources?: unknown }) => String(r.page_id) === PAGE_ID && Number(r.order_sources) === -1);
    const items = mine.map((r: unknown) => normalizeOrder(r as never));
    await saveOrders(db, conn, items);
    total += items.length;
    if (page >= Number(body.total_pages ?? 1)) { complete = true; break; }
  }
  if (!complete) throw new SourceError("PARTIAL", `pos orders còn trang sau ${seen} đơn đã đọc; checkpoint không được ghi`);
  await finish(db, conn, "orders");
  return { orders: total, seen, totalEntries, since, until };
}

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  if (!(await authorized(req, db))) return json({ error: "unauthorized" }, 401);
  const url = new URL(req.url);
  const job = url.searchParams.get("job");
  const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 2) || 2, 1), 31);
  try {
    if (job === "pancake") return json({ ok: true, ...(await runPancake(db, days)) });
    if (job === "pos") return json({ ok: true, ...(await runPos(db, days)) });
    return json({ error: "job phải là pancake hoặc pos" }, 400);
  } catch (e) {
    const code = e instanceof SourceError ? e.code : e instanceof SchemaChanged ? "SCHEMA_CHANGED" : "ERROR";
    return json({ ok: false, code, message: String((e as Error).message).slice(0, 300) }, 500);
  }
});

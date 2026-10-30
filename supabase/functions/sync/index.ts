// Worker dong bo chi-doc: Pancake Chat (hoi thoai) va Pancake POS (don) vao Supabase.
// Goi: POST /functions/v1/sync?job=pancake|pos&days=2&offset=0 voi header x-worker-secret hoac x-cron-token.
// Secrets: WORKER_TRIGGER_SECRET, PANCAKE_PAGE_TOKEN, POS_API_KEY (SUPABASE_URL va SERVICE_ROLE_KEY co san).
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

// URL co token trong query nen khong bao gio dua URL vao log hay thong bao loi.
async function getJson(url: string, label: string) {
  const res = await fetch(url);
  if (res.status === 401 || res.status === 403) throw new SourceError("AUTH_EXPIRED", `${label}: ${res.status}`);
  if (res.status === 429) throw new SourceError("RATE_LIMITED", `${label}: 429`);
  if (!res.ok) throw new SourceError("SOURCE_UNAVAILABLE", `${label}: ${res.status}`);
  return await res.json();
}

// offset > 0 lui cua so ve qua khu (lay lai tung doan ngay cu), until = het ngay cuoi cua cua so.
function windowOf(days: number, offset = 0) {
  const now = Math.floor(Date.now() / 1000);
  const todayVn = Math.floor((now + VN_OFFSET) / 86400) * 86400 - VN_OFFSET;
  const endDay = todayVn - offset * 86400;
  return { since: endDay - (days - 1) * 86400, until: Math.min(now, endDay + 86400 - 1) };
}

// deno-lint-ignore no-explicit-any
type Db = any;

async function connection(db: Db, provider: string, sourceId: string) {
  const { data, error } = await db.from("source_connections").select("id,workspace_id").eq("provider", provider).eq("source_id", sourceId).maybeSingle();
  if (error || !data) throw new SourceError("NOT_CONFIGURED", `Chua co ket noi ${provider} ${sourceId} trong source_connections`);
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

async function runPancake(db: Db, days: number, offset: number) {
  const token = Deno.env.get("PANCAKE_PAGE_TOKEN");
  if (!token) throw new SourceError("NOT_CONFIGURED", "Thieu secret PANCAKE_PAGE_TOKEN");
  const conn = await connection(db, "inbox", PAGE_ID);
  const { since, until } = windowOf(days, offset);
  let last: string | undefined;
  let total = 0;
  let complete = false;
  for (let page = 0; page < 60; page++) {
    const q = new URLSearchParams({ type: "INBOX", since: String(since), until: String(until), order_by: "inserted_at", fields: "id,inserted_at,updated_at,has_phone,tags,ads,ad_ids", page_access_token: token });
    if (last) q.set("last_conversation_id", last);
    const body = await getJson(`https://pages.fm/api/public_api/v2/pages/${PAGE_ID}/conversations?${q}`, "pancake conversations");
    const list = body?.conversations;
    if (!Array.isArray(list)) throw new SchemaChanged("conversations[]");
    // Ket thuc khi nguon tra trang rong, khong gia dinh kich thuoc trang.
    if (list.length === 0) { complete = true; break; }
    const items = list.map((r: unknown) => normalizeConversation(r as never));
    await saveConversations(db, conn, items);
    total += items.length;
    last = items[items.length - 1].sourceId;
  }
  if (!complete) throw new SourceError("PARTIAL", `pancake conversations con trang sau ${total} hoi thoai; checkpoint khong duoc ghi`);
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
  const facts = items.map((o) => ({ workspace_id: conn.workspace_id, order_id: idOf.get(o.sourceId)!, contract_version: CONTRACT_VERSION, source_fact_key: "order", recognition_date: o.recognitionDate, included: o.included, amount: o.amount, currency: "VND", reason: o.included ? null : `status ${o.status} khong thuoc tap tinh Total Sale` }));
  const up = await db.from("order_total_sale_facts").upsert(facts, { onConflict: "workspace_id,order_id,contract_version,source_fact_key" });
  if (up.error) throw new Error(`sale facts: ${up.error.message}`);
}

// Cach goi POS API da kiem bang thuc nghiem (28/10): ngay phai la camelCase startDateTime/endDateTime (snake_case bi bo qua va tra ca shop),
// order_sources[][] = [-1, page_id] loc dung page (19/10 ra 85 don), fields[] chi lay truong can (don day du ~13KB/don, de vuot bo nho).
const POS_FIELDS = ["id", "inserted_at", "updated_at", "status", "ad_id", "conversation_id", "total_price_after_sub_discount", "page_id", "order_sources"];

async function runPos(db: Db, days: number, offset: number) {
  const key = Deno.env.get("POS_API_KEY");
  if (!key) throw new SourceError("NOT_CONFIGURED", "Thieu secret POS_API_KEY");
  const conn = await connection(db, "pos", SHOP_ID);
  const { since, until } = windowOf(days, offset);
  const PAGE_SIZE = 100;
  const fetchPage = (page: number) => {
    const q = new URLSearchParams({ api_key: key, page_size: String(PAGE_SIZE), page_number: String(page), update_status: "inserted_at", startDateTime: String(since), endDateTime: String(until) });
    q.append("order_sources[][]", "-1");
    q.append("order_sources[][]", PAGE_ID);
    for (const f of POS_FIELDS) q.append("fields[]", f);
    return getJson(`https://pos.pages.fm/api/v1/shops/${SHOP_ID}/orders?${q}`, "pos orders");
  };
  let seen = 0;
  let total = 0;
  let totalEntries = 0;
  let totalPages = 1;
  for (let page = 1; page <= Math.min(totalPages, 200); page++) {
    const body = await fetchPage(page);
    if (!Array.isArray(body?.data)) throw new SchemaChanged("orders.data[]");
    if (page === 1) { totalPages = Number(body.total_pages ?? 1); totalEntries = Number(body.total_entries ?? 0); }
    seen += body.data.length;
    // Van loc lai o worker de khong ghi nham don page khac neu server bo qua bo loc.
    const mine = body.data.filter((r: { page_id?: unknown; order_sources?: unknown }) => String(r.page_id) === PAGE_ID && Number(r.order_sources) === -1);
    await saveOrders(db, conn, mine.map((r: unknown) => normalizeOrder(r as never)));
    total += mine.length;
  }
  if (seen !== totalEntries) throw new SourceError("PARTIAL", `POS tra ${seen}/${totalEntries} don`);
  await finish(db, conn, "orders");
  return { orders: total, seen, totalEntries, totalPages, since, until };
}

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  if (!(await authorized(req, db))) return json({ error: "unauthorized" }, 401);
  const url = new URL(req.url);
  const job = url.searchParams.get("job");
  const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 2) || 2, 1), 31);
  const offset = Math.min(Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0), 60);
  try {
    if (job === "pancake") return json({ ok: true, ...(await runPancake(db, days, offset)) });
    if (job === "pos") return json({ ok: true, ...(await runPos(db, days, offset)) });
    return json({ error: "job phai la pancake hoac pos" }, 400);
  } catch (e) {
    const code = e instanceof SourceError ? e.code : e instanceof SchemaChanged ? "SCHEMA_CHANGED" : "ERROR";
    return json({ ok: false, code, message: String((e as Error).message).slice(0, 300) }, 500);
  }
});

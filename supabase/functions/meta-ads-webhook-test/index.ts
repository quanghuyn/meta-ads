// Connectivity probe only. No database, no payload persistence or payload logging.
Deno.serve(async (req: Request) => {
  const headers = { "content-type": "application/json", "cache-control": "no-store" };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === "GET") return reply({ ok: true, mode: "test_only", persists_data: false });
  if (req.method !== "POST") return reply({ ok: false, error: "method_not_allowed" }, 405);
  const limit = 65536;
  if (Number(req.headers.get("content-length") || 0) > limit) return reply({ ok: false, error: "payload_too_large" }, 413);
  let size = 0;
  const reader = req.body?.getReader();
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
          await reader.cancel();
          return reply({ ok: false, error: "payload_too_large" }, 413);
        }
      }
    } catch { return reply({ ok: false, error: "body_read_failed" }, 400); }
  }
  return reply({ ok: true, received: true, bytes: size, mode: "test_only", persists_data: false });
});

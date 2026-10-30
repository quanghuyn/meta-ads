"use client";
import { createContext, useContext, useMemo, useState } from "react";
import { CIR_TARGET, compact as baseCompact, num as baseNum, pct as basePct, vnd as baseVnd } from "@/lib/format";
import type { DashboardCampaign } from "@/lib/dashboard-data";
import type { PosDashboardData as DashboardData } from "@/lib/pos-dashboard";
import { ShareDonut, SpendSaleChart } from "./charts";

const Data = createContext<DashboardData | null>(null);
const useData = () => { const d = useContext(Data); if (!d) throw Error("dashboard_data_required"); return d; };
const num = (v: number) => Number.isFinite(v) ? baseNum(v) : "—";
const vnd = (v: number) => Number.isFinite(v) ? baseVnd(v) : "—";
const compact = (v: number) => Number.isFinite(v) ? baseCompact(v) : "—";
const pct = (v: number, digits?: number) => Number.isFinite(v) ? basePct(v, digits) : "N/A";
const breakEven = 1 / CIR_TARGET;
const dm = (d: string) => d.slice(8) + "/" + d.slice(5, 7);
const dec = (n: number, d = 2) => Number.isFinite(n) ? n.toFixed(d).replace(".", ",") : "N/A";
const shift = (d: string, n: number) => {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

const makePresets = (first: string, last: string) => [
  { id: "today", label: "Hôm nay", from: last, to: last },
  { id: "yesterday", label: "Hôm qua", from: shift(last, -1), to: shift(last, -1) },
  { id: "3d", label: "3 ngày", from: shift(last, -2), to: last },
  { id: "7d", label: "7 ngày", from: first, to: last },
];

const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0);
const ratio = (n: number, d: number) => (Number.isFinite(n) && Number.isFinite(d) && d > 0 ? n / d : null);
const orNA = (v: number | null, f: (n: number) => string) => (v === null ? "N/A" : f(v));

type CampAgg = { id: string; name: string; account: string; spend: number; impressions: number; clicks: number; orders: number; sale: number };
const aggregate = (campaignDaily: DashboardCampaign[], f: string, t: string): CampAgg[] => {
  const map = new Map<string, CampAgg>();
  for (const r of campaignDaily) {
    if (r.date < f || r.date > t) continue;
    const a = map.get(r.id) ?? { id: r.id, name: r.name, account: r.account, spend: 0, impressions: 0, clicks: 0, orders: 0, sale: 0 };
    a.spend += r.spend; a.impressions += r.impressions; a.clicks += r.clicks; a.orders += r.orders; a.sale += r.sale;
    map.set(r.id, a);
  }
  return [...map.values()];
};
const rangeLabel = (f: string, t: string) => (f === t ? dm(f) : `${dm(f)} – ${dm(t)}`);

function Kpi({ label, badge, value, tone = "text-slate-900", foot }: {
  label: string; badge: string; value: string; tone?: string; foot: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2 text-xs text-slate-600">
        <span>{label}</span>
        <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-800">{badge}</span>
      </div>
      <div className={`mt-2 text-2xl font-bold ${tone}`}>{value}</div>
      <div className="mt-2 text-xs text-slate-600">{foot}</div>
    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-bold">{title}</h2>
      {sub && <p className="mt-1 text-xs text-slate-600">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}


const palette = ["#2563eb", "#059669", "#7c3aed", "#d97706", "#db2777", "#0891b2", "#65a30d", "#dc2626", "#475569"];

function BarBox({ title, hint, rows: inputRows, fmtv, best }: {
  title: string; hint: string; rows: { name: string; v: number }[]; fmtv: (n: number) => string; best: "max" | "min";
}) {
  const rows = inputRows.filter(r => Number.isFinite(r.v));
  const top = Math.max(...rows.map((r) => r.v), 1);
  const pick = best === "max" ? Math.max(...rows.map((r) => r.v)) : Math.min(...rows.map((r) => r.v));
  const star = rows.find((r) => r.v === pick);
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-900">{title}</span>
        {star && <span className="text-emerald-700">{hint}: {star.name} ({fmtv(star.v)})</span>}
      </div>
      <ul className="mt-2 space-y-1">
        {rows.map((r) => (
          <li key={r.name} className="grid grid-cols-[9rem_1fr_4.5rem] items-center gap-2 text-xs text-slate-900">
            <span className="truncate" title={r.name}>{r.name}</span>
            <span className="h-2 rounded bg-slate-100"><span className="block h-2 rounded bg-blue-600" style={{ width: `${(r.v / top) * 100}%` }} /></span>
            <span className="text-right font-medium">{fmtv(r.v)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Contribution({ from, to }: { from: string; to: string }) {
  const { campaignDaily } = useData();
  const rows = aggregate(campaignDaily, from, to);
  const sold = rows.filter((r) => r.sale > 0).sort((a, b) => b.sale - a.sale);
  const total = sum(sold, (r) => r.sale);
  const withAds = rows.filter((r) => r.impressions > 0);
  return (
    <Card title={`4. Cơ cấu đóng góp doanh thu và so sánh chỉ số kỹ thuật (${rangeLabel(from, to)})`} sub="Tỷ trọng Total Sale POS đã gán theo ad_id; chưa gán giữ riêng. CTR/CPM/CPC dùng số liệu Meta nhận từ DB.">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex flex-col items-center">
          {sold.length ? <ShareDonut data={sold.map((r, i) => ({ name: r.name, value: r.sale, color: palette[i % palette.length] }))} /> : <div className="flex h-56 w-56 items-center justify-center text-xs text-slate-500">Chưa có dữ liệu Total Sale</div>}
          <div className="-mt-1 text-xs text-slate-700">Tổng {sold.length ? vnd(total) : "—"} · {sold.length ? num(sum(sold, (r) => r.orders)) : "—"} đơn</div>
        </div>
        <ul className="min-w-[14rem] flex-1 space-y-1 text-xs text-slate-900">
          {sold.map((r, i) => (
            <li key={r.name} className="flex justify-between gap-2">
              <span><span style={{ color: palette[i % palette.length] }}>●</span> {r.name}</span>
              <span className="whitespace-nowrap font-medium">{pct(r.sale / total, 1)} ({vnd(r.sale)})</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 space-y-3">
        <BarBox title="CTR (tỷ lệ click tất cả), càng cao càng tốt" hint="Cao nhất" best="max" fmtv={(v) => pct(v, 2)} rows={withAds.map((r) => ({ name: r.name, v: r.clicks / r.impressions }))} />
        <BarBox title="CPM (giá 1.000 hiển thị), càng thấp càng rẻ" hint="Rẻ nhất" best="min" fmtv={(v) => num(Math.round(v))} rows={withAds.map((r) => ({ name: r.name, v: (r.spend * 1000) / r.impressions }))} />
        <BarBox title="CPC (giá mỗi click tất cả), càng thấp càng rẻ" hint="Rẻ nhất" best="min" fmtv={(v) => num(Math.round(v))} rows={withAds.filter((r) => r.clicks > 0).map((r) => ({ name: r.name, v: r.spend / r.clicks }))} />
      </div>
    </Card>
  );
}

function CirByCampaign({ from, to }: { from: string; to: string }) {
  const { campaignDaily, dayRows } = useData();
  const [day, setDay] = useState("range");
  const [f, t] = day === "range" ? [from, to] : [day, day];
  const shop = dayRows.filter((r) => r.date >= f && r.date <= t);
  const shopSpend = sum(shop, (r) => r.nk2.spend + r.nk3.spend);
  const shopSale = sum(shop, (r) => r.sale);
  const rows = aggregate(campaignDaily, f, t).filter((r) => r.spend > 0).sort((a, b) => b.spend - a.spend);
  const days = dayRows.filter((r) => r.date >= from && r.date <= to);
  const avg = ratio(shopSpend, shopSale);
  return (
    <Card title={`1. CIR theo chiến dịch so với ngưỡng ${pct(CIR_TARGET, 0)}`} sub="Vạch đen = ngưỡng. CIR = chi tiêu chiến dịch / Total Sale của đơn gán đúng chiến dịch (qua ad_id). Sắp theo chi tiêu.">
      <div className="mb-3 flex items-center gap-2 text-xs">
        <label htmlFor="cir-day" className="text-slate-700">Ngày xem</label>
        <select id="cir-day" value={days.some((d) => d.date === day) || day === "range" ? day : "range"} onChange={(e) => setDay(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-900">
          <option value="range">Cả khoảng {rangeLabel(from, to)}</option>
          {days.map((d) => <option key={d.date} value={d.date}>{dm(d.date)}</option>)}
        </select>
        <span className="text-slate-600">{rows.length} chiến dịch có chi tiêu</span>
      </div>
      <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
        {rows.map((r) => {
          const c = ratio(r.spend, r.sale);
          const over = c !== null && c > CIR_TARGET;
          return (
            <div key={r.id}>
              <div className="mb-0.5 flex justify-between gap-2 text-xs text-slate-900">
                <span className="truncate" title={`${r.name} (${r.account})`}><span className="font-semibold">{r.name}</span> <span className="text-slate-500">{r.account.replace("Nam Khoa ", "NK")}</span></span>
                <span className="whitespace-nowrap">{c === null ? `${Number.isFinite(r.orders) ? "Chưa có đơn gán" : "Chưa có dữ liệu đơn"} · chi ${compact(r.spend)}` : `${pct(c, 1)} · ${r.orders} đơn · chi ${compact(r.spend)}`}</span>
              </div>
              <div className="relative h-4 rounded bg-slate-100">
                <div className={`h-4 rounded ${c === null ? "bg-slate-400" : over ? "bg-red-500" : "bg-emerald-600"}`} style={{ width: `${c === null ? 100 : Math.min(c, 1) * 100}%` }} />
                <div className="absolute top-0 h-4 w-0.5 bg-slate-900" style={{ left: `${CIR_TARGET * 100}%` }} aria-label={`Ngưỡng ${pct(CIR_TARGET, 0)}`} />
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-xs text-slate-600">Không có chiến dịch chi tiêu trong ngày này.</p>}
      </div>
      <div className="mt-3 border-t pt-3">
        <div className="mb-0.5 flex justify-between text-xs font-semibold text-slate-900"><span>Toàn tài khoản (Total Sale cả shop)</span><span>{orNA(avg, (v) => pct(v, 1))}</span></div>
        <div className="relative h-4 rounded bg-slate-100">
          <div className={`h-4 rounded ${avg !== null && avg > CIR_TARGET ? "bg-red-500" : "bg-emerald-600"}`} style={{ width: `${Math.min(avg ?? 0, 1) * 100}%` }} />
          <div className="absolute top-0 h-4 w-0.5 bg-slate-900" style={{ left: `${CIR_TARGET * 100}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-600">Thang 0–100% (CIR trên 100% hiển thị đầy thanh). Đỏ = vượt ngưỡng, xanh = đạt, xám = chưa có đơn gán chiến dịch.</p>
      </div>
    </Card>
  );
}

function CampaignTable({ from, to }: { from: string; to: string }) {
  const { campaignDaily, unattributedDaily } = useData();
  const campaignDayRows: { name: string; account: string; mess?: number; phones?: number; qualified?: number; dup?: number; koNhuCau?: number }[] = [];
  const campaignDayOther: { label: string; mess: number; phones: number; qualified: number; dup: number; koNhuCau: number }[] = [];
  const [account, setAccount] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [onlySpend, setOnlySpend] = useState(true);
  const [sort, setSort] = useState("spend");
  const single = false;
  const conv = (r: CampAgg) => campaignDayRows.find((x) => x.name === r.name && x.account === r.account);
  const all = aggregate(campaignDaily, from, to);
  const view = (r: CampAgg) => ({ ...r, cir: ratio(r.spend, r.sale), conv: single ? conv(r) : undefined });
  const rows = all.map(view)
    .filter((r) => (account === "all" || r.account === account) && (!onlySpend || r.spend > 0 || r.orders > 0))
    .filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase()))
    .filter((r) => status === "all" || (status === "ok" && r.cir !== null && r.spend > 0 && r.cir <= CIR_TARGET) || (status === "over" && r.cir !== null && r.spend > 0 && r.cir > CIR_TARGET) || (status === "noorder" && r.spend > 0 && Number.isFinite(r.orders) && r.orders === 0))
    .sort((a, b) => sort === "cir" ? (b.cir ?? -1) - (a.cir ?? -1) : sort === "sale" ? b.sale - a.sale : b.spend - a.spend);
  const spend = sum(rows, (r) => r.spend);
  const sale = sum(rows, (r) => r.sale);
  const orders = sum(rows, (r) => r.orders);
  const tone = (c: number | null) => (c === null ? "text-slate-600" : c <= CIR_TARGET ? "text-emerald-700" : "text-red-600");
  const cpm = (r: { spend: number; impressions: number }) => orNA(ratio(r.spend * 1000, r.impressions), (v) => num(Math.round(v)));
  const ctr = (r: { clicks: number; impressions: number }) => orNA(ratio(r.clicks, r.impressions), (v) => pct(v, 2));
  const total = { spend, impressions: sum(rows, (r) => r.impressions), clicks: sum(rows, (r) => r.clicks) };
  const un = unattributedDaily.filter((u) => u.date >= from && u.date <= to);
  const unOrders = sum(un, (u) => u.unmapped.orders), unSale = sum(un, (u) => u.unmapped.sale);
  const noOrders = sum(un, (u) => u.noAd.orders), noSale = sum(un, (u) => u.noAd.sale);
  const cell = (v: number | undefined) => (v === undefined ? "—" : String(v));
  const sel = "rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900";
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-bold">5. Đánh giá chi tiết theo chiến dịch Meta ({rangeLabel(from, to)})</h2>
      <p className="mt-1 text-xs text-slate-600">Theo khoảng ngày đang chọn ở đầu trang. Doanh thu = đơn POS có ad_id thuộc chiến dịch. Qualified = nhãn XTS/RLCD + có SĐT. Ô chưa có dữ liệu nguồn hiện —; không dùng số liệu cũ thay thế.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input aria-label="Tìm tên chiến dịch" placeholder="Tìm tên chiến dịch" value={q} onChange={(e) => setQ(e.target.value)} className={sel} />
        <select aria-label="Lọc tài khoản" value={account} onChange={(e) => setAccount(e.target.value)} className={sel}>
          <option value="all">Cả hai tài khoản</option>
          <option value="Nam Khoa 2">Nam Khoa 2</option>
          <option value="Nam Khoa 3">Nam Khoa 3</option>
        </select>
        <select aria-label="Lọc theo CIR" value={status} onChange={(e) => setStatus(e.target.value)} className={sel}>
          <option value="all">Mọi mức CIR</option>
          <option value="ok">Đạt ngưỡng ({pct(CIR_TARGET, 0)} trở xuống)</option>
          <option value="over">Vượt ngưỡng</option>
          <option value="noorder">Có chi tiêu, chưa có đơn</option>
        </select>
        <select aria-label="Sắp xếp" value={sort} onChange={(e) => setSort(e.target.value)} className={sel}>
          <option value="spend">Sắp theo chi tiêu</option>
          <option value="sale">Sắp theo Total Sale</option>
          <option value="cir">Sắp theo CIR (cao xuống thấp)</option>
        </select>
        <label className="flex items-center gap-1 text-sm text-slate-800"><input type="checkbox" checked={onlySpend} onChange={(e) => setOnlySpend(e.target.checked)} />Ẩn chiến dịch không chi tiêu và không đơn</label>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead><tr className="border-b text-slate-600"><th className="py-1">Chiến dịch</th><th>TK</th><th>Chi tiêu</th><th>CPM</th><th>CTR</th><th>Đơn</th><th>Total Sale</th><th>CIR</th><th>Mess</th><th>SĐT</th><th>Qualified</th><th>Trùng</th><th>Ko nhu cầu</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b text-slate-900">
                <td className="py-1">{r.name}</td><td>{r.account.replace("Nam Khoa ", "NK")}</td><td>{vnd(r.spend)}</td><td>{cpm(r)}</td><td>{ctr(r)}</td><td>{num(r.orders)}</td><td>{r.sale ? vnd(r.sale) : "—"}</td>
                <td className={`font-semibold ${tone(r.spend > 0 ? r.cir : null)}`}>{r.spend === 0 ? "Không chi tiêu" : r.cir === null ? (Number.isFinite(r.orders) ? "Chưa có đơn gán" : "Chưa có dữ liệu đơn") : pct(r.cir, 1) + (r.cir > CIR_TARGET ? " ▲" : " ✓")}</td>
                <td>{cell(r.conv?.mess)}</td><td>{cell(r.conv?.phones)}</td><td>{cell(r.conv?.qualified)}</td><td>{cell(r.conv?.dup)}</td><td>{cell(r.conv?.koNhuCau)}</td>
              </tr>
            ))}
            <tr className="font-semibold text-slate-900"><td className="py-1">Tổng ({rows.length} chiến dịch)</td><td /><td>{vnd(total.spend)}</td><td>{cpm(total)}</td><td>{ctr(total)}</td><td>{num(orders)}</td><td>{vnd(sale)}</td><td className={tone(ratio(spend, sale))}>{orNA(ratio(spend, sale), (v) => pct(v, 1))}</td>
              <td>{single ? sum(rows, (r) => r.conv?.mess ?? 0) : "—"}</td><td>{single ? sum(rows, (r) => r.conv?.phones ?? 0) : "—"}</td><td>{single ? sum(rows, (r) => r.conv?.qualified ?? 0) : "—"}</td><td>{single ? sum(rows, (r) => r.conv?.dup ?? 0) : "—"}</td><td>{single ? sum(rows, (r) => r.conv?.koNhuCau ?? 0) : "—"}</td></tr>
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-3 text-xs text-slate-600">Không có chiến dịch khớp bộ lọc.</p>}
      </div>
      <ul className="mt-3 space-y-1 text-xs text-slate-700">
        {single && campaignDayOther.map((o) => (
          <li key={o.label}>Hội thoại chưa gán chiến dịch — {o.label}: {o.mess} hội thoại, {o.phones} SĐT, {o.qualified} qualified, {o.dup} trùng, {o.koNhuCau} ko nhu cầu.</li>
        ))}
        <li>Đơn chưa gán trong khoảng: {un.length ? num(unOrders) : "—"} đơn / {un.length ? vnd(unSale) : "—"} có ad_id ngoài Nam Khoa 2/3; {un.length ? num(noOrders) : "—"} đơn / {un.length ? vnd(noSale) : "—"} không có ad_id. Không chia theo chi tiêu.</li>
        <li>Nhãn hội thoại chồng nhau (một hội thoại có thể vừa “Trùng khách” vừa có nhãn nhu cầu), không trừ chéo. Hội thoại tính theo quảng cáo chạm đầu tiên.</li>
        <li>Hai chiến dịch cùng tên “CĐ - cp - MERA” và hai chiến dịch “27.10” là chiến dịch khác nhau, phân biệt bằng hậu tố trong ngoặc.</li>
      </ul>
    </section>
  );
}

export function Dashboard({ data }: { data: DashboardData }) {
  return <Data.Provider value={data}><DashboardView /></Data.Provider>;
}

function DashboardView() {
  const { dayRows, first, last, asOf, snapshot, excludedAccounts, posSyncedAt, posAvailable } = useData();
  const presets = makePresets(first, last);
  const [from, setFrom] = useState(shift(last, -6) < first ? first : shift(last, -6));
  const [to, setTo] = useState(last);
  const active = presets.find((p) => p.from === from && p.to === to)?.id ?? "custom";

  const pick = (f: string, t: string) => {
    if (f > t) [f, t] = [t, f];
    setFrom(f < first ? first : f);
    setTo(t > last ? last : t);
  };

  const m = useMemo(() => {
    const rows = dayRows.filter((r) => r.date >= from && r.date <= to);
    const spend2 = sum(rows, (r) => r.nk2.spend);
    const spend3 = sum(rows, (r) => r.nk3.spend);
    const imp2 = sum(rows, (r) => r.nk2.impressions), imp3 = sum(rows, (r) => r.nk3.impressions);
    const clk2 = sum(rows, (r) => r.nk2.clicks), clk3 = sum(rows, (r) => r.nk3.clicks);
    return {
      rows, spend2, spend3, imp2, imp3, clk2, clk3,
      spend: spend2 + spend3, impressions: imp2 + imp3, clicks: clk2 + clk3,
      sale: sum(rows, (r) => r.sale), orders: sum(rows, (r) => r.orders),
      saleAd: sum(rows, (r) => r.saleAd), ordersAd: sum(rows, (r) => r.ordersAd),
      inbox: sum(rows, (r) => r.inbox), phones: sum(rows, (r) => r.phones),
    };
  }, [from, to, dayRows]);

  const cir = ratio(m.spend, m.sale);
  const roas = ratio(m.sale, m.spend);
  const cirTone = cir === null ? "text-slate-900" : cir <= CIR_TARGET ? "text-emerald-700" : "text-red-600";
  const sub = (n: number) => `${dec(n * 100)} điểm`;

  return (
    <main className="mx-auto min-h-screen max-w-7xl space-y-5 bg-slate-50 p-4 text-slate-900 sm:p-6">
      <div role="note" className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sm text-sky-900">
        <b>Dữ liệu Supabase · {dm(asOf)}.</b> Chi tiêu: Meta NK2 + NK3 (1114645597047575), cấp chiến dịch. Snapshot {snapshot ? new Date(snapshot).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "chưa có"}. Tải lại để lấy số mới; chỉ các dòng đã nhận. POS shop 1546758: {posAvailable && posSyncedAt ? `đã nhận đến ${new Date(posSyncedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}` : "chưa đọc được"}; số liệu hai nguồn khác thời điểm, CIR/ROAS tạm tính. Pancake chưa nối; — không phải 0. {excludedAccounts.length > 0 && <>Chưa gộp tài khoản ngoài hai cột gốc/chưa rõ tiền tệ: {excludedAccounts.join(", ")}.</>}
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Tổng quan Ads × Doanh thu</h1>
          <p className="text-xs text-slate-600">Total Sale theo ngày tạo đơn · VND · Asia/Ho_Chi_Minh</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Chọn khoảng thời gian">
          {presets.map((p) => (
            <button key={p.id} type="button" onClick={() => pick(p.from, p.to)} aria-pressed={active === p.id}
              className={`rounded-lg border px-3 py-1.5 text-sm ${active === p.id ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100"}`}>
              {p.label}
            </button>
          ))}
          <label className="flex items-center gap-1 text-sm text-slate-700">Từ
            <input type="date" min={first} max={last} value={from} onChange={(e) => e.target.value && pick(e.target.value, to)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-900" />
          </label>
          <label className="flex items-center gap-1 text-sm text-slate-700">đến
            <input type="date" min={first} max={last} value={to} onChange={(e) => e.target.value && pick(from, e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-900" />
          </label>
        </div>
      </header>

      {m.rows.length === 0 ? (
        <p className="rounded-lg border bg-white p-6 text-sm">Không có dữ liệu trong khoảng đã chọn.</p>
      ) : (
        <>
          <p className="text-xs text-slate-600">
            Đang xem {dm(from)} – {dm(to)} ({m.rows.length} ngày){to === last ? `; ngày ${dm(last)} chưa trọn ngày` : ""}.
          </p>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <Kpi label="CIR (chi phí / Total Sale shop)" badge={cir === null ? "N/A" : (cir <= CIR_TARGET ? "Dư " : "Vượt ") + sub(Math.abs(CIR_TARGET - cir))}
              value={orNA(cir, (v) => pct(v))} tone={cirTone} foot={`Mục tiêu ${pct(CIR_TARGET, 0)} · ${vnd(m.spend)} / ${vnd(m.sale)}`} />
            <Kpi label="ROAS (Total Sale shop / chi tiêu)" badge={`Hoà vốn ${dec(breakEven)}x`} value={orNA(roas, (v) => dec(v) + "x")}
              tone={roas === null ? "text-slate-900" : roas >= breakEven ? "text-blue-700" : "text-red-600"} foot="Doanh thu cả shop, kể cả đơn không có ad_id" />
            <Kpi label="Total Sale" badge={`${num(m.orders)} đơn`} value={vnd(m.sale)} foot={`AOV: ${orNA(ratio(m.sale, m.orders), vnd)}`} />
            <Kpi label="Chi tiêu Meta" badge="NK2 + NK3" value={vnd(m.spend)} foot={`${num(m.impressions)} hiển thị · CPM ${orNA(ratio(m.spend * 1000, m.impressions), vnd)}`} />
            <Kpi label="CPA (chi tiêu / đơn)" badge="Toàn shop" value={orNA(ratio(m.spend, m.orders), vnd)} foot={`CPA hoà vốn: ${orNA(ratio(m.sale * CIR_TARGET, m.orders), vnd)}`} />
            <Kpi label="Đơn có ad_id" badge={`${num(m.ordersAd)}/${num(m.orders)} đơn`} value={orNA(ratio(m.saleAd, m.sale), (v) => pct(v, 1))} foot={`${vnd(m.saleAd)} · chưa xác minh thuộc NK2/NK3`} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <CirByCampaign from={from} to={to} />

            <Card title="2. Chi tiêu vs Total Sale và ROAS" sub="Tiền và ROAS dùng hai trục riêng.">
              <SpendSaleChart breakEven={breakEven}
                data={m.rows.map((r) => ({ name: dm(r.date), spend: r.nk2.spend + r.nk3.spend, sale: r.sale, roas: r.sale / (r.nk2.spend + r.nk3.spend), sub: `${num(r.orders)} đơn` }))} />
            </Card>

            <Card title="3. Phễu quảng cáo → đơn" sub="Hội thoại và SĐT lấy từ Pancake, tính cả đơn không từ quảng cáo; chưa tách qualified nên chưa có tỷ lệ chốt. Không chia đơn cho click.">
              <ol className="space-y-2 text-sm">
                <li className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-900">Hiển thị: <b>{num(m.impressions)}</b> <span className="text-xs text-slate-700">· CPM {orNA(ratio(m.spend * 1000, m.impressions), vnd)}</span></li>
                <li className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-indigo-900">Click (tất cả): <b>{num(m.clicks)}</b> <span className="text-xs text-slate-700">· CTR {orNA(ratio(m.clicks, m.impressions), (v) => pct(v))} · CPC {orNA(ratio(m.spend, m.clicks), vnd)}</span></li>
                <li className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">Hội thoại inbox mới: <b>{num(m.inbox)}</b> <span className="text-xs text-slate-700">· {orNA(ratio(m.spend, m.inbox), vnd)}/hội thoại · mọi nguồn</span></li>
                <li className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-yellow-900">SĐT thu được: <b>{num(m.phones)}</b> <span className="text-xs text-slate-700">· {orNA(ratio(m.spend, m.phones), vnd)}/SĐT · {orNA(ratio(m.phones, m.inbox), (v) => pct(v, 1))} so với hội thoại mới</span></li>
                <li className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">Đơn POS: <b>{num(m.orders)}</b> <span className="text-xs text-slate-700">· {vnd(m.sale)} · CPA {orNA(ratio(m.spend, m.orders), vnd)}</span></li>
              </ol>
            </Card>

            <Contribution from={from} to={to} />
          </div>

          <CampaignTable from={from} to={to} />

          <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm" open>
            <summary className="cursor-pointer font-semibold">Bảng số liệu theo ngày</summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead><tr className="border-b text-slate-600"><th className="py-1">Ngày</th><th>Chi tiêu NK2</th><th>Chi tiêu NK3</th><th>Tổng chi tiêu</th><th>Total Sale</th><th>Đơn</th><th>Hội thoại</th><th>SĐT</th><th>CIR</th><th>ROAS</th></tr></thead>
                <tbody>
                  {m.rows.map((r) => {
                    const s = r.nk2.spend + r.nk3.spend;
                    return (
                      <tr key={r.date} className="border-b text-slate-900">
                        <td className="py-1">{dm(r.date)}</td><td>{vnd(r.nk2.spend)}</td><td>{vnd(r.nk3.spend)}</td><td>{vnd(s)}</td><td>{vnd(r.sale)}</td><td>{num(r.orders)}</td><td>{num(r.inbox)}</td><td>{num(r.phones)}</td>
                        <td>{pct(s / r.sale)}</td><td>{Number.isFinite(r.sale / s) ? dec(r.sale / s) + "x" : "N/A"}</td>
                      </tr>
                    );
                  })}
                  <tr className="font-semibold text-slate-900"><td className="py-1">Tổng</td><td>{vnd(m.spend2)}</td><td>{vnd(m.spend3)}</td><td>{vnd(m.spend)}</td><td>{vnd(m.sale)}</td><td>{num(m.orders)}</td><td>{num(m.inbox)}</td><td>{num(m.phones)}</td><td>{orNA(cir, (v) => pct(v))}</td><td>{orNA(roas, (v) => dec(v) + "x")}</td></tr>
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </main>
  );
}

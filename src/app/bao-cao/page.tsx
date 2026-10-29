import { Suspense } from 'react';
import Link from 'next/link';
import { reportClient } from '@/lib/supabase-server';
import { knownTotal, reportRange, type SnapshotRow } from '@/lib/report';

export const metadata = { title: 'Báo cáo Ads · dữ liệu Supabase' };

const fmt = (v: number | string | null) => v === null ? 'N/A' : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 4 });

function State({ code, children }: { code: string; children: React.ReactNode }) {
  return <main className="mx-auto max-w-5xl p-8"><h1 className="text-2xl font-bold">Báo cáo Ads</h1><p className="mt-4 font-mono">{code}</p><div className="mt-3">{children}</div></main>;
}

async function BaoCaoContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const range = reportRange(query.from, query.to);
  if (!range) return <State code="invalid_range">Khoảng ngày không hợp lệ (tối đa 367 ngày).</State>;
  const db = await reportClient();
  if (!db) return <State code="not_configured">Chưa cấu hình Supabase URL và anon key. Không dùng dữ liệu tĩnh thay thế.</State>;
  const load = async (): Promise<{ code: string; message: string } | { rows: SnapshotRow[] }> => {
    try {
      const { data: { user }, error: authError } = await db.auth.getUser();
      if (authError || !user) return { code: 'authentication_required', message: 'Đăng nhập tài khoản team marketing để xem báo cáo.' };
      // Membership comes from authenticated DB/RLS; workspace is never accepted from the URL.
      const { data: memberships, error: membershipError } = await db.from('memberships').select('workspace_id,role').eq('user_id', user.id).eq('active', true).in('role', ['admin', 'marketing']);
      if (membershipError) return { code: 'unavailable', message: 'Không đọc được quyền workspace.' };
      if (!memberships?.length) return { code: 'forbidden', message: 'Tài khoản chưa có quyền admin/marketing.' };
      if (memberships.length !== 1) return { code: 'workspace_selection_required', message: 'Có nhiều workspace. Chưa hỗ trợ chọn workspace; không tự trộn dữ liệu.' };
      const collected: SnapshotRow[] = [];
      // Explicit pagination avoids silently accepting PostgREST's default 1000-row cap.
      // Exact count also detects installations configured with a smaller cap.
      for (let offset = 0; offset < 20000; offset += 1000) {
        const { data, error, count } = await db.rpc('report_meta_webhook', { p_workspace_id: memberships[0].workspace_id, p_from: range.from, p_to: range.to }, { count: 'exact' }).range(offset, offset + 999);
        if (error) return { code: error.code === '42501' ? 'forbidden' : 'unavailable', message: 'Không đọc được báo cáo. Kiểm tra migration và quyền truy cập ở server.' };
        const page = (data ?? []) as SnapshotRow[];
        collected.push(...page);
        if (count === null) return { code: 'unavailable', message: 'Không xác minh được số dòng báo cáo; không hiển thị tổng có thể thiếu.' };
        if (collected.length === count) return { rows: collected };
        if (page.length !== 1000) return { code: 'unavailable', message: 'Dữ liệu bị giới hạn hoặc thay đổi khi đọc. Thu hẹp ngày rồi thử lại.' };
      }
      return { code: 'range_too_large', message: 'Báo cáo vượt giới hạn 20.000 dòng. Thu hẹp khoảng ngày.' };
    } catch {
      return { code: 'unavailable', message: 'Không kết nối được Supabase. Không hiển thị số liệu cũ/tĩnh.' };
    }
  };
  const result = await load();
  if ('code' in result) return <State code={result.code}>{result.message}{result.code === 'authentication_required' && <Link href="/dang-nhap" className="mt-3 block underline">Đăng nhập</Link>}</State>;
  const rows = result.rows;
  const accounts = [...new Set(rows.map(r => r.account_id))];
  if (query.account !== undefined && (typeof query.account !== 'string' || !accounts.includes(query.account))) return <State code="invalid_account">Tài khoản không có trong các route được cấp quyền. Không tự chuyển sang tài khoản khác.</State>;
  const selected = typeof query.account === 'string' ? query.account : accounts[0];
  const account = rows.find(r => r.account_id === selected);
  const facts = rows.filter(r => r.account_id === selected && r.source_date !== null);
  return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-slate-500">Supabase · webhook snapshots</p><h1 className="text-3xl font-bold">Báo cáo Ads</h1><p className="mt-2 text-sm text-slate-600">Dữ liệu DB đã xác thực. Không cộng chung sync-meta và các cấp campaign/adset/ad.</p></div><Link className="underline" href="/dang-nhap">Tài khoản</Link></header>
    <form className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4" method="get">
      <label className="grid gap-1 text-sm">Từ ngày<input className="rounded border p-2" type="date" name="from" defaultValue={range.from} required /></label>
      <label className="grid gap-1 text-sm">Đến ngày<input className="rounded border p-2" type="date" name="to" defaultValue={range.to} required /></label>
      <label className="grid gap-1 text-sm">Tài khoản<select className="rounded border p-2" name="account" defaultValue={selected}>{accounts.map(id => <option key={id} value={id}>{rows.find(r => r.account_id === id)?.account_name ?? id} · {id}</option>)}</select></label>
      <button className="rounded bg-slate-900 px-5 py-2 text-white">Xem báo cáo</button>
    </form>
    {!accounts.length ? <section className="rounded border p-5"><h2 className="font-bold">not_configured</h2><p>Chưa có route webhook đang bật cho connection Meta active. Không tự gán NK1, NK2 hoặc NK3.</p></section> : <>
      <section className="rounded-xl border bg-white p-5"><h2 className="font-bold">{account?.account_name ?? selected} · {selected}</h2><p className="mt-2 text-sm">Cấp báo cáo: {account?.report_level} · Tiền tệ: {account?.currency ?? 'chưa xác minh'} · Múi giờ nguồn: {account?.source_timezone ?? 'chưa xác minh'}</p>
      <p className="mt-2 text-sm text-amber-800">Latest snapshot theo từng entity/ngày; chỉ các dòng nhận được, chưa xác nhận coverage đầy đủ. Dòng vắng không được suy thành 0. Không gộp tài khoản.</p></section>
      <section className="grid gap-4 sm:grid-cols-3">{(['spend', 'impressions', 'clicks'] as const).map((key, i) => <div key={key} className="rounded-xl border bg-white p-5"><h2 className="text-sm text-slate-600">{['Chi tiêu đã nhận (không phải toàn tài khoản)', 'Lượt hiển thị đã nhận', 'Click đã nhận'][i]}</h2><p className="mt-2 text-2xl font-bold tabular-nums">{fmt(knownTotal(facts, key))}{key === 'spend' ? ` ${account?.currency ?? '(chưa rõ tiền tệ)'}` : ''}</p></div>)}</section>
      {!facts.length ? <p className="rounded border p-5">empty · Chưa có snapshot hợp lệ trong khoảng ngày này.</p> : <section className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr>{['Ngày', 'Entity', 'Chi tiêu', 'Hiển thị', 'Click', 'Mess Meta', 'Snapshot UTC'].map(h => <th className="whitespace-nowrap p-3" key={h}>{h}</th>)}</tr></thead><tbody>{facts.map(r => <tr className="border-t" key={`${r.account_id}:${r.report_level}:${r.entity_id}:${r.source_date}`}><td className="whitespace-nowrap p-3">{r.source_date}</td><td className="p-3"><div>{r.entity_name ?? 'Chưa có tên'}</div><div className="font-mono text-xs text-slate-500">{r.entity_id}</div></td><td className="p-3 tabular-nums">{fmt(r.spend)}</td><td className="p-3 tabular-nums">{fmt(r.impressions)}</td><td className="p-3 tabular-nums">{fmt(r.clicks)}</td><td className="p-3 tabular-nums">{fmt(r.messaging_actions)}</td><td className="whitespace-nowrap p-3">{r.generated_at}</td></tr>)}</tbody></table></section>}
    </>}
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold">Doanh thu / CIR / qualified: unavailable</h2><p className="mt-2 text-sm">Luồng này chỉ xác minh Meta webhook. Chưa nối/đối soát POS và Pancake tại màn hình này; không thay bằng dữ liệu tĩnh, số 0 hay doanh thu phân bổ theo spend. N/A là thiếu dữ liệu, không phải 0.</p></section>
  </main>;
}

export default function BaoCaoPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <Suspense fallback={<p>?ang t?i b?o c?o?</p>}><BaoCaoContent {...props} /></Suspense>; }

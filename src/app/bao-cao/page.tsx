import { Suspense } from 'react';
import Link from 'next/link';
import { connection } from 'next/server';
import { reportClient } from '@/lib/supabase-server';
import { reportRange, type SnapshotRow } from '@/lib/report';
import { dashboardData } from '@/lib/dashboard-data';
import { Dashboard } from './dashboard';
import { withPos, type PosDashboardRow } from '@/lib/pos-dashboard';

export const metadata = { title: 'Báo cáo Ads · dữ liệu Supabase' };


function State({ code, children }: { code: string; children: React.ReactNode }) {
  return <main className="mx-auto max-w-5xl p-8"><h1 className="text-2xl font-bold">Báo cáo Ads</h1><p className="mt-4 font-mono">{code}</p><div className="mt-3">{children}</div></main>;
}

async function BaoCaoContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const query = await searchParams;
  const range = reportRange(query.from, query.to);
  if (!range) return <State code="invalid_range">Khoảng ngày không hợp lệ (tối đa 367 ngày).</State>;
  const db = await reportClient();
  if (!db) return <State code="not_configured">Chưa cấu hình Supabase URL và anon key. Không dùng dữ liệu tĩnh thay thế.</State>;
  const load = async (): Promise<{ code: string; message: string } | { rows: SnapshotRow[]; workspaceId: string }> => {
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
        if (collected.length === count) return { rows: collected, workspaceId: memberships[0].workspace_id };
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
  let pos: PosDashboardRow[] | null = null;
  try {
    const collected: PosDashboardRow[] = [];
    for (let offset = 0; offset < 20000; offset += 1000) {
      const { data, error, count } = await db.rpc('report_pos_dashboard', { p_workspace_id: result.workspaceId, p_from: range.from, p_to: range.to }, { count: 'exact' }).range(offset, offset + 999);
      if (error || count === null) break;
      const page = (data ?? []) as PosDashboardRow[];
      collected.push(...page);
      if (collected.length === count) { pos = collected; break; }
      if (page.length !== 1000) break;
    }
  } catch { /* Meta still renders; POS stays explicitly unavailable. */ }
  return <Dashboard data={withPos(dashboardData(rows, range.from, range.to), pos)} />;
}

export default function BaoCaoPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <Suspense fallback={<p>Đang tải báo cáo…</p>}><BaoCaoContent {...props} /></Suspense>; }

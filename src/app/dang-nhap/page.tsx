import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { reportClient } from '@/lib/supabase-server';
import { loginDestination } from '@/lib/login-destination';


async function login(form: FormData) {
  'use server';
  const next = loginDestination(form.get('next'));
  const errorUrl = `/dang-nhap?error=login&next=${encodeURIComponent(next)}`;
  const db = await reportClient(true);
  if (!db) redirect(`/dang-nhap?error=config&next=${encodeURIComponent(next)}`);
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!email || !password || email.length > 254 || password.length > 1000) redirect(errorUrl);
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) redirect(errorUrl);
  redirect(next);
}
async function logout() {
  'use server';
  const db = await reportClient(true);
  if (db) await db.auth.signOut();
  redirect('/dang-nhap');
}
async function LoginContent({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  const destination = loginDestination(next);
  const db = await reportClient();
  return <main className="mx-auto max-w-md space-y-5 p-8"><h1 className="text-2xl font-bold">Đăng nhập báo cáo</h1><p>Chỉ tài khoản team có membership admin/marketing được đọc báo cáo.</p>
    {!db ? <p role="status">not_configured · Chưa cấu hình Supabase.</p> : <>
      {error && <p role="alert">Không đăng nhập được. Kiểm tra tài khoản và cấu hình Auth.</p>}
      <form action={login} className="grid gap-4"><input type="hidden" name="next" value={destination} /><label className="grid gap-1">Email<input className="rounded border p-2" name="email" type="email" autoComplete="username" required maxLength={254} /></label><label className="grid gap-1">Mật khẩu<input className="rounded border p-2" name="password" type="password" autoComplete="current-password" required maxLength={1000} /></label><button className="rounded bg-slate-900 p-3 text-white">Đăng nhập</button></form>
      <form action={logout}><button className="underline">Đăng xuất</button></form>
    </>}
    <Link className="block underline" href="/bao-cao">Về báo cáo</Link>
  </main>;
}

export default function LoginPage(props: { searchParams: Promise<{ error?: string; next?: string }> }) { return <Suspense fallback={<p>Đang tải…</p>}><LoginContent {...props} /></Suspense>; }

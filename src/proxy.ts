import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseConfig } from './lib/supabase-server';

export async function proxy(request: NextRequest) {
  const config = supabaseConfig();
  let response = NextResponse.next({ request });
  if (config) {
    const db = createServerClient(config.url, config.key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: values => {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    try { await db.auth.getUser(); } catch { /* Page fails closed and shows unavailable. */ }
  }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = { matcher: ['/bao-cao/:path*', '/dang-nhap'] };

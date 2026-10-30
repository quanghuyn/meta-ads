import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function supabaseConfig() {
  // The hosted project may have an unrelated, integration-managed Supabase.
  // A report-specific pair overrides it atomically; never mix projects/keys.
  const reportUrl = process.env.REPORT_SUPABASE_URL;
  const reportKey = process.env.REPORT_SUPABASE_PUBLISHABLE_KEY;
  if (reportUrl || reportKey) {
    return reportUrl && reportKey ? { url: reportUrl, key: reportKey } : null;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export async function reportClient(writable = false) {
  const config = supabaseConfig();
  if (!config) return null;
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: values => {
        // Server renders cannot set cookies; src/proxy.ts refreshes sessions first.
        if (writable) values.forEach(({ name, value, options }) => jar.set(name, value, options));
      },
    },
  });
}

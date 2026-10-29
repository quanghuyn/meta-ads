import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function supabaseConfig() {
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

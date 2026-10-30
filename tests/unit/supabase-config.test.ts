import { afterEach, describe, expect, it, vi } from 'vitest';
import { supabaseConfig } from '../../src/lib/supabase-server';

afterEach(() => vi.unstubAllEnvs());
function defaults() {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://legacy.example');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'legacy-public');
  vi.stubEnv('REPORT_SUPABASE_URL', '');
  vi.stubEnv('REPORT_SUPABASE_PUBLISHABLE_KEY', '');
}
describe('report-specific Supabase configuration', () => {
  it('uses legacy public pair for local compatibility', () => {
    defaults();
    expect(supabaseConfig()).toEqual({ url: 'https://legacy.example', key: 'legacy-public' });
  });
  it('uses the report pair instead of an unrelated integration', () => {
    defaults();
    vi.stubEnv('REPORT_SUPABASE_URL', 'https://report.example');
    vi.stubEnv('REPORT_SUPABASE_PUBLISHABLE_KEY', 'report-public');
    expect(supabaseConfig()).toEqual({ url: 'https://report.example', key: 'report-public' });
  });
  it('fails closed rather than mixing projects when report key missing', () => {
    defaults();
    vi.stubEnv('REPORT_SUPABASE_URL', 'https://report.example');
    expect(supabaseConfig()).toBeNull();
  });
  it('fails closed rather than mixing projects when report URL missing', () => {
    defaults();
    vi.stubEnv('REPORT_SUPABASE_PUBLISHABLE_KEY', 'report-public');
    expect(supabaseConfig()).toBeNull();
  });
});

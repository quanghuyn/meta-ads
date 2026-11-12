import type { reportClient } from './supabase-server';

type Db = NonNullable<Awaited<ReturnType<typeof reportClient>>>;
export type ReportAccess =
  | { workspaceId: string }
  | { code: 'authentication_required' | 'membership_unavailable' | 'forbidden' | 'workspace_selection_required' };

// Membership comes from authenticated DB/RLS; workspace is never accepted from the URL.
// Exactly one admin/marketing workspace is required: no tenant mixing, no implicit choice.
export async function reportAccess(db: Db): Promise<ReportAccess> {
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user) return { code: 'authentication_required' };
  const { data: memberships, error } = await db
    .from('memberships')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('active', true)
    .in('role', ['admin', 'marketing']);
  if (error) return { code: 'membership_unavailable' };
  if (!memberships?.length) return { code: 'forbidden' };
  if (memberships.length !== 1) return { code: 'workspace_selection_required' };
  return { workspaceId: memberships[0].workspace_id };
}

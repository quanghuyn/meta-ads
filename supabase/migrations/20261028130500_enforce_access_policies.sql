-- Mặc định khoá: không bảng nào cho anon. authenticated chỉ đọc bảng báo cáo theo membership.
revoke all on all tables in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;

-- Bảng không chứa dữ liệu khách: admin + marketing đọc theo workspace.
grant select on public.workspaces, public.memberships, public.ad_entities,
  public.ad_query_profiles, public.ad_insights_daily, public.rule_versions to authenticated;
grant select (id, workspace_id, provider, source_id, name, state, last_success_at, source_timezone, currency)
  on public.source_connections to authenticated;   -- không cấp credential_ref

create policy workspaces_read on public.workspaces for select to authenticated
  using (app.has_role(id, array['admin','marketing','sales']::app.member_role[]));
create policy memberships_read_self on public.memberships for select to authenticated
  using (user_id = (select auth.uid()));
create policy connections_read on public.source_connections for select to authenticated
  using (app.has_role(workspace_id, array['admin','marketing']::app.member_role[]));
create policy ad_entities_read on public.ad_entities for select to authenticated
  using (app.has_role(workspace_id, array['admin','marketing']::app.member_role[]));
create policy ad_profiles_read on public.ad_query_profiles for select to authenticated
  using (app.has_role(workspace_id, array['admin','marketing']::app.member_role[]));
create policy ad_insights_read on public.ad_insights_daily for select to authenticated
  using (app.has_role(workspace_id, array['admin','marketing']::app.member_role[]));
create policy rule_versions_read on public.rule_versions for select to authenticated
  using (app.has_role(workspace_id, array['admin','marketing']::app.member_role[]));

-- conversations, conversation_evidence, orders, sale facts, attribution, sync_*, audit_events:
-- không có policy cho authenticated (chứa SĐT/khách). Chỉ đọc qua RPC tổng hợp (migration create-reporting-functions) hoặc service_role.

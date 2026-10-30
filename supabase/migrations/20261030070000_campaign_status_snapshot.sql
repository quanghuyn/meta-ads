-- Read-only status snapshots. Never infer Meta activity from spend or conversations.
create or replace function public.report_pancake_campaign_status_quality(p_workspace_id uuid,p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path=public,app,pg_temp as $$
declare base jsonb; enriched jsonb;
begin
 base:=public.report_pancake_campaign_quality(p_workspace_id,p_from,p_to);
 with raw_candidates as (
  select regexp_replace(app.webhook_text(c.source_id),'^act_','') as account_id,app.webhook_text(f.entity_id) as campaign_id,
   case when jsonb_typeof(f.raw_row->'status')='string' then upper(btrim(f.raw_row->>'status')) end as status,
   case when jsonb_typeof(f.raw_row->'effective_status')='string' then upper(btrim(f.raw_row->>'effective_status')) end as effective_status,
   f.generated_at as snapshot_at,'webhook_snapshot'::text as source,1 as priority
  from meta_webhook_facts f join source_connections c on c.id=f.connection_id and c.workspace_id=f.workspace_id and c.provider='meta'
  where f.workspace_id=p_workspace_id and f.level='campaign'
  union all
  select regexp_replace(app.webhook_text(c.source_id),'^act_',''),app.webhook_text(e.source_id),upper(btrim(e.source_status)),null,
   e.updated_at,'legacy_metadata',0
  from ad_entities e join source_connections c on c.id=e.connection_id and c.workspace_id=e.workspace_id and c.provider='meta'
  where e.workspace_id=p_workspace_id and e.kind='campaign'
 ), cleaned as (
  select r.account_id,r.campaign_id,
   case when r.status ~ '^[A-Z_]{1,64}$' then r.status end as status,
   case when r.effective_status ~ '^[A-Z_]{1,64}$' then r.effective_status end as effective_status,
   r.snapshot_at,r.source,r.priority from raw_candidates r
 ), candidates as (
  select * from cleaned where status is not null or effective_status is not null
 )
 select coalesce(jsonb_agg(r.item || jsonb_build_object(
  'meta_status',m.status,'meta_effective_status',m.effective_status,
  'meta_status_at',m.snapshot_at,'meta_status_source',m.source
 ) order by r.ordinality),'[]'::jsonb) into enriched
 from jsonb_array_elements(base->'campaigns') with ordinality as r(item,ordinality)
 left join lateral (
  select s.status,s.effective_status,s.snapshot_at,s.source from candidates s
  where s.account_id=r.item->>'account_id' and s.campaign_id=r.item->>'campaign_id'
  order by s.snapshot_at desc,s.priority desc limit 1
 )m on r.item->>'bucket'='campaign';
 return base || jsonb_build_object('campaigns',enriched,'status_model','meta_snapshot_v1');
end $$;
revoke all on function public.report_pancake_campaign_status_quality(uuid,date,date) from public,anon;
grant execute on function public.report_pancake_campaign_status_quality(uuid,date,date) to authenticated;

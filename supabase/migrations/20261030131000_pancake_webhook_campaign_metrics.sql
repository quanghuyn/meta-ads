-- Moving Meta metrics use WEBHOOK ONLY. Never multiply campaign spend by conversations/touches.
create or replace function public.report_pancake_campaign_webhook_quality(p_workspace_id uuid,p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path=public,app,pg_temp as $$
declare base jsonb; enriched jsonb; expected integer;
begin
 base:=public.report_pancake_campaign_quality(p_workspace_id,p_from,p_to);
 expected:=p_to-p_from+1;
 with profiles as (
  select c.id,regexp_replace(app.webhook_text(c.source_id),'^act_','') as account_id,
   case when upper(btrim(c.currency)) ~ '^[A-Z]{3}$' then upper(btrim(c.currency)) end as currency
  from source_connections c join meta_webhook_routes r on r.connection_id=c.id and r.workspace_id=c.workspace_id
  where c.workspace_id=p_workspace_id and c.provider='meta' and c.state='active' and r.enabled and r.report_level='campaign'
 )
 select coalesce(jsonb_agg(r.item || jsonb_build_object(
  'meta_status',s.status,'meta_effective_status',s.effective_status,
  'meta_status_at',case when s.status is not null or s.effective_status is not null then s.generated_at end,
  'meta_status_source',case when s.status is not null or s.effective_status is not null then 'webhook_snapshot' end,
  'spend_received',m.amount,
  'spend_currency',case when p.n=1 then p.currency end,
  'spend_days',m.known_days,'spend_rows',m.received_days,
  'spend_expected_days',case when r.item->>'bucket'='campaign' then expected else 0 end,
  'spend_at',m.generated_at,
  'spend_source',case when r.item->>'bucket'='campaign' and p.n=1 then 'webhook' end,
  'spend_issue',case when r.item->>'bucket'<>'campaign' then 'unassigned' when p.n=0 then 'source_unavailable' when p.n>1 then 'ambiguous_account' when m.received_days=0 then 'no_rows' when m.known_days=0 then 'missing_values' else null end
 ) order by r.ordinality),'[]'::jsonb) into enriched
 from jsonb_array_elements(base->'campaigns') with ordinality as r(item,ordinality)
 cross join lateral (
  select count(*) as n,(array_agg(a.id))[1] as connection_id,max(a.currency) as currency from profiles a
  where r.item->>'bucket'='campaign' and a.account_id=r.item->>'account_id'
 )p
 cross join lateral (
  select count(*)::integer as received_days,count(f.spend)::integer as known_days,sum(f.spend) as amount,max(f.generated_at) as generated_at
  from meta_webhook_facts f
  where p.n=1 and f.workspace_id=p_workspace_id and f.connection_id=p.connection_id and f.level='campaign'
   and f.entity_id=r.item->>'campaign_id' and f.source_date between p_from and p_to
 )m
 left join lateral (
  select
   case when jsonb_typeof(f.raw_row->'status')='string' and upper(btrim(f.raw_row->>'status')) ~ '^[A-Z_]{1,64}$' then upper(btrim(f.raw_row->>'status')) end as status,
   case when jsonb_typeof(f.raw_row->'effective_status')='string' and upper(btrim(f.raw_row->>'effective_status')) ~ '^[A-Z_]{1,64}$' then upper(btrim(f.raw_row->>'effective_status')) end as effective_status,
   f.generated_at
  from meta_webhook_facts f
  where p.n=1 and f.workspace_id=p_workspace_id and f.connection_id=p.connection_id and f.level='campaign'
   and f.entity_id=r.item->>'campaign_id' and (f.raw_row ? 'status' or f.raw_row ? 'effective_status')
  order by f.generated_at desc,f.source_date desc limit 1
 )s on r.item->>'bucket'='campaign';
 return base || jsonb_build_object('campaigns',enriched,'metrics_model','meta_webhook_metrics_v1','spend_from',p_from,'spend_to',p_to);
end $$;
revoke all on function public.report_pancake_campaign_webhook_quality(uuid,date,date) from public,anon;
grant execute on function public.report_pancake_campaign_webhook_quality(uuid,date,date) to authenticated;

-- Aggregate-only POS read model. Does not modify order data or expand raw-data access.
create or replace function public.report_pos_dashboard(p_workspace_id uuid,p_from date,p_to date)
returns table(day date,bucket text,account_id text,campaign_id text,campaign_name text,
 orders bigint,total_sale numeric,orders_ad bigint,sale_ad numeric,pos_synced_at timestamptz)
language plpgsql stable security definer set search_path=public,app,pg_temp as $$
begin
 if not app.has_role(p_workspace_id,array['admin','marketing']::app.member_role[]) then
  raise exception 'forbidden' using errcode='42501'; end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then
  raise exception 'invalid date range' using errcode='22023'; end if;
 return query
 with source as (
  select c.id,c.last_success_at from source_connections c
  where c.workspace_id=p_workspace_id and c.provider='pos' and c.source_id='1546758' and c.state='active'
 ), observed as (
  select f.recognition_date as d,o.id as order_id,nullif(btrim(o.source_ad_id),'') as ad_id,
   coalesce(sum(f.amount) filter(where f.included),0) as amount,bool_or(f.included) as included
  from order_total_sale_facts f join orders o on o.id=f.order_id and o.workspace_id=f.workspace_id
  join source s on s.id=o.connection_id
  where f.workspace_id=p_workspace_id and f.currency='VND' and o.currency='VND'
   and f.contract_version=(select max(f2.contract_version) from order_total_sale_facts f2 where f2.workspace_id=p_workspace_id)
   and f.recognition_date between p_from and p_to
  group by f.recognition_date,o.id,nullif(btrim(o.source_ad_id),'')
 ), candidates as (
  select f.entity_id as ad_id,c.source_id as account_id,f.campaign_id,
   coalesce((select max(fc.entity_name) from meta_webhook_facts fc where fc.workspace_id=p_workspace_id
    and fc.connection_id=f.connection_id and fc.level='campaign' and fc.entity_id=f.campaign_id),f.campaign_id) as campaign_name
  from meta_webhook_facts f join source_connections c on c.id=f.connection_id and c.workspace_id=f.workspace_id
  where f.workspace_id=p_workspace_id and f.level='ad' and f.campaign_id is not null
  union all
  select a.source_id,c.source_id,cp.source_id,cp.name
  from ad_entities a join ad_entities parent on parent.id=a.parent_id and parent.workspace_id=a.workspace_id
  join ad_entities cp on cp.workspace_id=a.workspace_id and cp.kind='campaign'
   and (cp.id=parent.id or (parent.kind='adset' and cp.id=parent.parent_id))
  join source_connections c on c.id=a.connection_id and c.workspace_id=a.workspace_id
  where a.workspace_id=p_workspace_id and a.kind='ad' and c.provider='meta'
   and cp.connection_id=a.connection_id and parent.connection_id=a.connection_id
 ), mapping as (
  select x.ad_id,min(x.account_id) as account_id,min(x.campaign_id) as campaign_id,max(x.campaign_name) as campaign_name
  from candidates x group by x.ad_id
  having count(distinct (x.account_id,x.campaign_id))=1
 ), daily as (
  select o.d,count(*) filter(where o.included) as orders,coalesce(sum(o.amount) filter(where o.included),0) as amount,
   count(*) filter(where o.included and o.ad_id is not null) as orders_ad,
   coalesce(sum(o.amount) filter(where o.included and o.ad_id is not null),0) as sale_ad
  from observed o group by o.d
 ), assigned as (
  select o.d,case when o.ad_id is null then 'no_ad_id' when m.ad_id is null then 'ad_unknown' else 'campaign' end as bucket,
   m.account_id,m.campaign_id,m.campaign_name,count(*) as orders,sum(o.amount) as amount
  from observed o left join mapping m on m.ad_id=o.ad_id where o.included
  group by o.d,2,m.account_id,m.campaign_id,m.campaign_name
 ), freshness as (select max(s.last_success_at) as at from source s)
 select gs.dt::date,'shop'::text,null::text,null::text,null::text,
  v.orders,v.amount,v.orders_ad,v.sale_ad,f.at
 from generate_series(p_from,p_to,interval '1 day') as gs(dt)
 left join daily v on v.d=gs.dt::date cross join freshness f
 union all
 select a.d,a.bucket,a.account_id,a.campaign_id,a.campaign_name,a.orders,a.amount,null::bigint,null::numeric,f.at
 from assigned a cross join freshness f
 order by 1,2,3,4;
end $$;
revoke all on function public.report_pos_dashboard(uuid,date,date) from public,anon;
grant execute on function public.report_pos_dashboard(uuid,date,date) to authenticated;

-- Đối soát đơn POS với Meta theo chiến dịch x ngày. Đơn gán theo ad_id trên đơn (quyết định D10):
-- ad -> chiến dịch cha. Đơn không gán được hiện thành dòng riêng, không chia theo tỷ lệ chi tiêu.
-- Spend và đơn được gộp riêng theo (chiến dịch, ngày) rồi mới nối nên không nhân lên.
create function public.report_campaign_daily(p_workspace_id uuid, p_from date, p_to date)
returns table (
  day date,
  bucket text,               -- 'campaign' | 'no_ad_id' | 'ad_unknown'
  campaign_source_id text,
  campaign_name text,
  spend numeric,
  orders bigint,
  total_sale numeric
)
language plpgsql stable security definer
set search_path = public, app, pg_temp
as $$
#variable_conflict use_column
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'invalid date range' using errcode = '22023';
  end if;
  if coalesce(current_setting('role', true), '') <> 'service_role'
     and not app.has_role(p_workspace_id, array['admin','marketing']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  with spend as (
    select i.source_date as day, e.id as campaign_id, sum(i.spend) as spend
    from ad_insights_daily i
    join ad_entities e on e.workspace_id = i.workspace_id and e.id = i.ad_entity_id and e.kind = 'campaign'
    join ad_query_profiles p on p.workspace_id = i.workspace_id and p.connection_id = i.connection_id
                            and p.profile_hash = i.query_profile_hash and p.active
    join source_connections c on c.workspace_id = i.workspace_id and c.id = i.connection_id and c.state = 'active'
    where i.workspace_id = p_workspace_id and i.source_date between p_from and p_to
    group by i.source_date, e.id
  ),
  ad_to_campaign as (
    select a.source_id as ad_source_id, min(a.parent_id::text)::uuid as campaign_id
    from ad_entities a
    where a.workspace_id = p_workspace_id and a.kind = 'ad' and a.parent_id is not null
    group by a.source_id
    having count(distinct a.parent_id) = 1          -- ad_id trùng nhiều chiến dịch thì không đoán
  ),
  sale as (
    select f.recognition_date as day, o.source_ad_id, sum(f.amount) as amount, count(*) as n
    from order_total_sale_facts f
    join orders o on o.workspace_id = f.workspace_id and o.id = f.order_id
    where f.workspace_id = p_workspace_id and f.included
      and f.contract_version = (select max(contract_version) from order_total_sale_facts where workspace_id = p_workspace_id)
      and f.recognition_date between p_from and p_to
    group by f.recognition_date, o.source_ad_id
  ),
  sale_by_bucket as (
    select s.day,
           case when s.source_ad_id is null then 'no_ad_id'
                when m.campaign_id is null then 'ad_unknown' else 'campaign' end as bucket,
           m.campaign_id, sum(s.amount) as amount, sum(s.n) as n
    from sale s left join ad_to_campaign m on m.ad_source_id = s.source_ad_id
    group by 1, 2, 3
  )
  select coalesce(sp.day, sb.day), coalesce(sb.bucket, 'campaign'), ce.source_id, ce.name,
         coalesce(sp.spend, 0), coalesce(sb.n, 0)::bigint, coalesce(sb.amount, 0)
  from spend sp
  full join (select * from sale_by_bucket where bucket = 'campaign') sb
    on sb.day = sp.day and sb.campaign_id = sp.campaign_id
  left join ad_entities ce on ce.workspace_id = p_workspace_id and ce.id = coalesce(sp.campaign_id, sb.campaign_id)
  union all
  select sb.day, sb.bucket, null, null, 0, sb.n::bigint, sb.amount
  from sale_by_bucket sb where sb.bucket <> 'campaign'
  order by 1, 2, 3;
end;
$$;
revoke all on function public.report_campaign_daily(uuid, date, date) from public, anon;
grant execute on function public.report_campaign_daily(uuid, date, date) to authenticated, service_role;

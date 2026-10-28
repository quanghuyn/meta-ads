-- RPC tổng hợp theo ngày (giờ VN) cho dashboard. Mỗi nguồn được gộp riêng theo ngày rồi mới nối,
-- nên chi tiêu không bị nhân lên qua join. Chỉ trả số tổng hợp, không trả SĐT/nội dung khách.
create function public.report_daily(p_workspace_id uuid, p_from date, p_to date)
returns table (
  day date,
  spend numeric,
  impressions bigint,
  clicks bigint,
  orders bigint,
  total_sale numeric,
  conversations bigint,
  with_phone bigint,
  qualified bigint
)
language plpgsql stable security definer
set search_path = public, app, pg_temp
as $$
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'invalid date range' using errcode = '22023';
  end if;
  if coalesce(current_setting('role', true), '') <> 'service_role'
     and not app.has_role(p_workspace_id, array['admin','marketing']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  with days as (
    select d::date as day from generate_series(p_from, p_to, interval '1 day') d
  ),
  ads as (
    select i.source_date as day, sum(i.spend) as spend, sum(i.impressions) as impressions,
           sum(i.clicks_all) as clicks
    from ad_insights_daily i
    join ad_entities e on e.workspace_id = i.workspace_id and e.id = i.ad_entity_id and e.kind = 'campaign'
    join ad_query_profiles p on p.workspace_id = i.workspace_id and p.connection_id = i.connection_id
                            and p.profile_hash = i.query_profile_hash and p.active
    join source_connections c on c.workspace_id = i.workspace_id and c.id = i.connection_id and c.state = 'active'
    where i.workspace_id = p_workspace_id and i.source_date between p_from and p_to
    group by i.source_date
  ),
  sales as (
    select f.recognition_date as day, count(*) as orders, sum(f.amount) as total_sale
    from order_total_sale_facts f
    where f.workspace_id = p_workspace_id and f.included
      and f.contract_version = (select max(contract_version) from order_total_sale_facts where workspace_id = p_workspace_id)
      and f.recognition_date between p_from and p_to
    group by f.recognition_date
  ),
  convs as (
    select (cv.source_inserted_at at time zone 'Asia/Ho_Chi_Minh')::date as day,
           count(*) as conversations,
           count(*) filter (where cv.has_phone) as with_phone,
           count(*) filter (where cv.has_phone and exists (
             select 1 from conversation_evidence ev
             where ev.workspace_id = cv.workspace_id and ev.conversation_id = cv.id
               and ev.kind = 'tag' and ev.active and ev.value ->> 'text' in ('XTS', 'RLCD', 'XTS + RLCD')
           )) as qualified
    from conversations cv
    where cv.workspace_id = p_workspace_id and cv.eligibility <> 'excluded'
      and (cv.source_inserted_at at time zone 'Asia/Ho_Chi_Minh')::date between p_from and p_to
    group by 1
  )
  select d.day, coalesce(a.spend, 0), coalesce(a.impressions, 0)::bigint, coalesce(a.clicks, 0)::bigint,
         coalesce(s.orders, 0), coalesce(s.total_sale, 0),
         coalesce(v.conversations, 0), coalesce(v.with_phone, 0), coalesce(v.qualified, 0)
  from days d
  left join ads a using (day) left join sales s using (day) left join convs v using (day)
  order by d.day;
end;
$$;
revoke all on function public.report_daily(uuid, date, date) from public, anon;
grant execute on function public.report_daily(uuid, date, date) to authenticated, service_role;

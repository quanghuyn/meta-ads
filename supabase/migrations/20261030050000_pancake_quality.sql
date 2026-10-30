-- Private aggregate read model for Pancake. No raw customer IDs, phones or message text.
create or replace function public.report_pancake_quality(p_workspace_id uuid,p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path=public,app,pg_temp as $$
declare result jsonb;
begin
 if not app.has_role(p_workspace_id,array['admin','marketing']::app.member_role[]) then
  raise exception 'forbidden' using errcode='42501'; end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then
  raise exception 'invalid date range' using errcode='22023'; end if;
 with source as (
  select c.id,c.last_success_at from source_connections c
  where c.workspace_id=p_workspace_id and c.provider='inbox' and c.source_id='196059750263125' and c.state='active'
 ), obs as (
  select cv.id,(cv.source_inserted_at at time zone 'Asia/Ho_Chi_Minh')::date as day,
   cv.has_phone,cv.eligibility,cv.updated_at,
   exists(select 1 from conversation_evidence e where e.workspace_id=p_workspace_id and e.conversation_id=cv.id
    and e.kind='tag' and e.origin='source' and e.active and e.value->>'text' in ('XTS','RLCD','XTS + RLCD')) as needs,
   exists(select 1 from conversation_evidence e where e.workspace_id=p_workspace_id and e.conversation_id=cv.id
    and e.kind='tag' and e.origin='source' and e.active and nullif(btrim(e.value->>'text'),'') is not null) as labelled,
   exists(select 1 from ad_touches a where a.workspace_id=p_workspace_id and a.conversation_id=cv.id) as with_ad
  from conversations cv join source s on s.id=cv.connection_id
  where cv.workspace_id=p_workspace_id
   and cv.source_inserted_at >= (p_from::timestamp at time zone 'Asia/Ho_Chi_Minh')
   and cv.source_inserted_at < ((p_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh')
 ), counts as (
  select o.day,count(*) as observed,
   count(*) filter(where o.eligibility<>'excluded') as conversations,
   count(*) filter(where o.eligibility<>'excluded' and o.has_phone) as with_phone,
   count(*) filter(where o.eligibility<>'excluded' and o.has_phone and o.needs) as qualified,
   count(*) filter(where o.eligibility<>'excluded' and not o.labelled) as unlabelled,
   count(*) filter(where o.eligibility<>'excluded' and o.with_ad) as with_ad,
   count(*) filter(where o.eligibility='excluded') as excluded,
   count(*) filter(where o.eligibility='unknown') as unknown_eligibility
  from obs o group by o.day
 ), daily as (
  select d.dt::date as day,c.conversations,c.with_phone,c.qualified,c.unlabelled,c.with_ad,c.excluded,c.unknown_eligibility
  from generate_series(p_from,p_to,interval '1 day') as d(dt) left join counts c on c.day=d.dt::date
 ), tag_counts as (
  select btrim(e.value->>'text') as tag,count(distinct o.id) as conversations
  from obs o join conversation_evidence e on e.conversation_id=o.id and e.workspace_id=p_workspace_id
  where o.eligibility<>'excluded' and e.kind='tag' and e.origin='source' and e.active
   and nullif(btrim(e.value->>'text'),'') is not null
   and length(e.value->>'text')<=120 and e.value->>'text' !~ '[0-9]{7,}'
  group by btrim(e.value->>'text')
 )
 select jsonb_build_object(
  'page_id','196059750263125','timezone','Asia/Ho_Chi_Minh',
  'source_configured',exists(select 1 from source),
  'synced_at',(select max(s.last_success_at) from source s),
  'observed_at',(select max(o.updated_at) from obs o),
  'days',(select coalesce(jsonb_agg(to_jsonb(d) order by d.day),'[]'::jsonb) from daily d),
  'tags',(select coalesce(jsonb_agg(to_jsonb(t) order by t.conversations desc,t.tag),'[]'::jsonb) from tag_counts t),
  'definition_version',1
 ) into result;
 return result;
end $$;
revoke all on function public.report_pancake_quality(uuid,date,date) from public,anon;
grant execute on function public.report_pancake_quality(uuid,date,date) to authenticated;

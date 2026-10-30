-- Single-snapshot aggregate: Pancake ad_id -> verified Meta ad_id -> campaign IDs.
-- Each conversation is assigned exactly once; missing/conflicting/multi-campaign touches stay separate.
create or replace function public.report_pancake_campaign_quality(p_workspace_id uuid,p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path=public,app,pg_temp as $$
declare base jsonb; grouped jsonb;
begin
 -- Existing base RPC checks access/range and shares this statement snapshot.
 base:=public.report_pancake_quality(p_workspace_id,p_from,p_to);
 with obs as (
  select cv.id,cv.has_phone,
   coalesce((select array_agg(distinct e.value->>'text') from conversation_evidence e
    where e.workspace_id=p_workspace_id and e.conversation_id=cv.id and e.kind='tag' and e.origin='source' and e.active),'{}'::text[]) as tags
  from conversations cv join source_connections s on s.id=cv.connection_id and s.workspace_id=cv.workspace_id
  where cv.workspace_id=p_workspace_id and s.provider='inbox' and s.source_id='196059750263125' and s.state='active'
   and cv.eligibility<>'excluded'
   and cv.source_inserted_at >= (p_from::timestamp at time zone 'Asia/Ho_Chi_Minh')
   and cv.source_inserted_at < ((p_to+1)::timestamp at time zone 'Asia/Ho_Chi_Minh')
 ), names as (
  select distinct on (f.connection_id,f.entity_id) f.connection_id,f.entity_id,f.entity_name
  from meta_webhook_facts f where f.workspace_id=p_workspace_id and f.level='campaign'
  order by f.connection_id,f.entity_id,f.generated_at desc
 ), candidates as (
  select app.webhook_text(f.entity_id) as ad_id,regexp_replace(app.webhook_text(c.source_id),'^act_','') as account_id,
   app.webhook_text(f.campaign_id) as campaign_id,coalesce(n.entity_name,f.campaign_id) as campaign_name,true as from_webhook
  from meta_webhook_facts f join source_connections c on c.id=f.connection_id and c.workspace_id=f.workspace_id and c.provider='meta'
  left join names n on n.connection_id=f.connection_id and n.entity_id=f.campaign_id
  where f.workspace_id=p_workspace_id and f.level='ad' and f.campaign_id is not null
  union all
  select app.webhook_text(a.source_id),regexp_replace(app.webhook_text(c.source_id),'^act_',''),app.webhook_text(cp.source_id),cp.name,false
  from ad_entities a join ad_entities parent on parent.id=a.parent_id and parent.workspace_id=a.workspace_id
  join ad_entities cp on cp.workspace_id=a.workspace_id and cp.kind='campaign'
   and (cp.id=parent.id or (parent.kind='adset' and cp.id=parent.parent_id))
  join source_connections c on c.id=a.connection_id and c.workspace_id=a.workspace_id
  where a.workspace_id=p_workspace_id and a.kind='ad' and c.provider='meta'
   and cp.connection_id=a.connection_id and parent.connection_id=a.connection_id
 ), mapping as (
  select x.ad_id,min(x.account_id) as account_id,min(x.campaign_id) as campaign_id,coalesce(max(x.campaign_name) filter(where x.from_webhook),max(x.campaign_name)) as campaign_name
  from candidates x where x.ad_id is not null and x.account_id is not null and x.campaign_id is not null
  group by x.ad_id having count(distinct (x.account_id,x.campaign_id))=1
 ), touches as (
  select distinct o.id as conversation_id,app.webhook_text(t.source_ad_id) as ad_id
  from obs o join ad_touches t on t.conversation_id=o.id and t.workspace_id=p_workspace_id
 ), resolved as (
  select o.id,o.has_phone,o.tags,
   case when count(t.conversation_id)=0 then 'no_ad_id'
    when count(*) filter(where t.conversation_id is not null and m.ad_id is null)>0 then 'unknown_ad'
    when count(distinct (m.account_id,m.campaign_id)) filter(where m.ad_id is not null)>1 then 'multi_campaign'
    else 'campaign' end as bucket,
   min(m.account_id) as account_id,min(m.campaign_id) as campaign_id,max(m.campaign_name) as campaign_name
  from obs o left join touches t on t.conversation_id=o.id left join mapping m on m.ad_id=t.ad_id
  group by o.id,o.has_phone,o.tags
 ), classified as (
  select r.id,r.has_phone,r.tags,r.bucket,
   case when r.bucket='campaign' then r.account_id end as account_id,
   case when r.bucket='campaign' then r.campaign_id end as campaign_id,
   case when r.bucket='campaign' then coalesce(r.campaign_name,r.campaign_id) end as campaign_name
  from resolved r
 ), totals as (
  select r.bucket,r.account_id,r.campaign_id,r.campaign_name,count(*) as conversations,
   count(*) filter(where r.has_phone) as with_phone,
   count(*) filter(where r.has_phone and r.tags && array['XTS','RLCD','XTS + RLCD']) as qualified,
   count(*) filter(where 'Trùng khách'=any(r.tags)) as duplicate,
   count(*) filter(where 'Ko có nhu cầu'=any(r.tags)) as no_need,
   count(*) filter(where 'Chốt đơn'=any(r.tags)) as closed_tag
  from classified r group by r.bucket,r.account_id,r.campaign_id,r.campaign_name
 )
 select coalesce(jsonb_agg(to_jsonb(t) order by (t.bucket='campaign') desc,t.conversations desc,t.account_id,t.campaign_id),'[]'::jsonb)
 into grouped from totals t;
 return base || jsonb_build_object('campaigns',grouped,'attribution_model','unique_all_touches_v1');
end $$;
revoke all on function public.report_pancake_campaign_quality(uuid,date,date) from public,anon;
grant execute on function public.report_pancake_campaign_quality(uuid,date,date) to authenticated;

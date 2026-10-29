-- Observed daily export compatibility; no production replay.
create or replace function public.process_meta_webhook(p_inbox_id uuid) returns text
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
 p jsonb; r jsonb; previous jsonb; lvl text; delivery text; stamp timestamptz;
 account text; ent text; d date; stop_date date; row_date date; range_from date; range_to date; messages numeric; conn record; keys text[] := '{}'; k text;
 code text := 'processed';
begin
 if coalesce(current_setting('role',true),'') <> 'service_role' then
   raise exception 'forbidden' using errcode = '42501';
 end if;
 select payload into p from meta_webhook_inbox where id=p_inbox_id for update;
 if not found then raise exception 'receipt_not_found'; end if;
 -- Catch validation errors inside a subtransaction, leaving the immutable inbox intact.
 begin
  if jsonb_typeof(p) <> 'object' then raise exception 'invalid_envelope'; end if;
  if p ? '_test' and p->'_test' <> 'false'::jsonb then raise exception 'test_excluded'; end if;
  if coalesce(p->>'schema_version','') <> '1' then raise exception 'unsupported_schema'; end if;
  lvl := p->>'level';
  if lvl is null or lvl not in ('campaign','adset','ad') then raise exception 'invalid_level'; end if;
  delivery := nullif(btrim(p->>'delivery_id'),'');
  if delivery is null or length(delivery)>200 then raise exception 'invalid_delivery'; end if;
  if coalesce(p->>'generated_at','') !~ '^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$' then raise exception 'invalid_generated_at'; end if;
  stamp := (p->>'generated_at')::timestamptz;
  if stamp > now() + interval '5 minutes' then raise exception 'future_snapshot'; end if;
  if jsonb_typeof(p->'rows') is distinct from 'array' or jsonb_array_length(p->'rows')=0 then raise exception 'missing_rows'; end if;
  if jsonb_array_length(p->'rows')>10000 then raise exception 'too_many_rows'; end if;
  -- Serialise competing deliveries and compare actual JSON, not a collision-prone hash.
  perform pg_advisory_xact_lock(hashtext('meta-webhook-delivery'),hashtext(delivery));
  select payload into previous from meta_webhook_deliveries where delivery_id=delivery;
  if found then
   if previous <> p then raise exception 'delivery_conflict'; end if;
   update meta_webhook_inbox set status='processed',mapping_code='duplicate' where id=p_inbox_id;
   return 'duplicate';
  end if;
  insert into meta_webhook_deliveries values (delivery,p_inbox_id,p);
  for r in select value from jsonb_array_elements(p->'rows') loop
   if jsonb_typeof(r) <> 'object' then raise exception 'invalid_row'; end if;
   if r ? '_test' and r->'_test' <> 'false'::jsonb then raise exception 'test_excluded'; end if;
   account := app.webhook_text(coalesce(r->>'account_id',p->>'account_id'));
   if account is null or account !~ '^[0-9]+$' then raise exception 'missing_account'; end if;
   if p ? 'account_id' and app.webhook_text(p->>'account_id') is distinct from account then raise exception 'account_conflict'; end if;
   select c.id,c.workspace_id into conn from source_connections c
    join meta_webhook_routes m on m.connection_id=c.id and m.workspace_id=c.workspace_id and m.enabled
    where c.provider='meta' and c.source_id=account and c.state='active';
   if not found then raise exception 'unmapped_account'; end if;
   -- Ambiguous account ownership across workspaces must never pick an arbitrary tenant.
   if (select count(*) from source_connections c join meta_webhook_routes m on m.connection_id=c.id and m.enabled
       where c.provider='meta' and c.source_id=account and c.state='active') <> 1 then raise exception 'ambiguous_account'; end if;
   ent := app.webhook_text(r->>(lvl || '_id'));
   if ent is null or ent !~ '^[0-9]+$' then raise exception 'missing_entity'; end if;
   if coalesce(app.webhook_text(r->>'date_start'),'') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid_date'; end if;
   d := app.webhook_text(r->>'date_start')::date;
   if r ? 'level' and r->>'level' is distinct from lvl then raise exception 'invalid_level'; end if;
   -- A missing stop is accepted only with independent row + envelope daily proof.
   if r ? 'date' then
    if coalesce(app.webhook_text(r->>'date'),'') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid_date'; end if;
    row_date := app.webhook_text(r->>'date')::date;
    if row_date <> d then raise exception 'non_daily_row'; end if;
   end if;
   if r ? 'date_stop' then
    if coalesce(app.webhook_text(r->>'date_stop'),'') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'non_daily_row'; end if;
    stop_date := app.webhook_text(r->>'date_stop')::date;
    if stop_date <> d then raise exception 'non_daily_row'; end if;
   else
    if not (r ? 'date') or jsonb_typeof(p->'range') is distinct from 'object' then raise exception 'non_daily_row'; end if;
    if coalesce(p->'range'->>'from','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(p->'range'->>'to','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid_date'; end if;
    range_from := (p->'range'->>'from')::date;
    range_to := (p->'range'->>'to')::date;
    if range_from <> d or range_to <> d then raise exception 'non_daily_row'; end if;
   end if;
   messages := app.webhook_number(r->>'actions_onsite_conversion_messaging_conversation_started_7d',true);
   if r ? 'messaging_actions' and r ? 'actions_onsite_conversion_messaging_conversation_started_7d'
     and app.webhook_number(r->>'messaging_actions',true) is distinct from messages then raise exception 'messaging_alias_conflict'; end if;
   if not (r ? 'actions_onsite_conversion_messaging_conversation_started_7d') then messages := app.webhook_number(r->>'messaging_actions',true); end if;
   k := conn.id::text || ':' || lvl || ':' || ent || ':' || d::text;
   if k = any(keys) then raise exception 'duplicate_row_key'; end if;
   keys := array_append(keys,k);
   -- Equal generated_at with different values is ambiguous: retain old fact, reject whole receipt.
   perform 1 from meta_webhook_facts f where f.connection_id=conn.id and f.level=lvl::app.ad_entity_kind
    and f.entity_id=ent and f.source_date=d and f.generated_at=stamp and f.raw_row <> r;
   if found then raise exception 'snapshot_conflict'; end if;
   insert into meta_webhook_facts as f
    (workspace_id,connection_id,level,entity_id,source_date,entity_name,campaign_id,adset_id,
     spend,impressions,clicks,messaging_actions,generated_at,delivery_id,inbox_id,raw_row)
   values (conn.workspace_id,conn.id,lvl::app.ad_entity_kind,ent,d,r->>(lvl||'_name'),
    app.webhook_text(r->>'campaign_id'),app.webhook_text(r->>'adset_id'),
    app.webhook_number(r->>'spend'),app.webhook_number(r->>'impressions',true)::bigint,
    app.webhook_number(r->>'clicks',true)::bigint,messages::bigint,
    stamp,delivery,p_inbox_id,r)
   on conflict (connection_id,level,entity_id,source_date) do update set
    entity_name=excluded.entity_name,campaign_id=excluded.campaign_id,adset_id=excluded.adset_id,
    spend=excluded.spend,impressions=excluded.impressions,clicks=excluded.clicks,
    messaging_actions=excluded.messaging_actions,generated_at=excluded.generated_at,
    delivery_id=excluded.delivery_id,inbox_id=excluded.inbox_id,raw_row=excluded.raw_row
   where excluded.generated_at > f.generated_at;
  end loop;
 exception when others then
  code := case when sqlerrm in ('invalid_envelope','test_excluded','unsupported_schema','invalid_level',
   'invalid_delivery','invalid_generated_at','future_snapshot','missing_rows','too_many_rows','delivery_conflict',
   'invalid_row','missing_account','account_conflict','unmapped_account','ambiguous_account','missing_entity',
   'messaging_alias_conflict','invalid_date','non_daily_row','duplicate_row_key','snapshot_conflict','invalid_number') then sqlerrm else 'invalid_payload' end;
 end;
 update meta_webhook_inbox set status=case when code='processed' then 'processed' else 'rejected' end,mapping_code=code where id=p_inbox_id;
 return code;
end $$;
revoke all on function public.process_meta_webhook(uuid) from public,anon,authenticated;
grant execute on function public.process_meta_webhook(uuid) to service_role;


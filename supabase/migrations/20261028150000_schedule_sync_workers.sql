-- Lịch đồng bộ mỗi 30 phút. Token gọi worker do database tự sinh trong vault, không nằm trong repo.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'worker_cron_token', 'Token để lịch và quản trị gọi Edge Function sync')
where not exists (select 1 from vault.secrets where name = 'worker_cron_token');

create or replace function public.verify_cron_token(token text)
returns boolean language sql security definer set search_path = '' as $$
  select coalesce(exists (select 1 from vault.decrypted_secrets where name = 'worker_cron_token' and decrypted_secret = token), false);
$$;
revoke all on function public.verify_cron_token(text) from public, anon, authenticated;
grant execute on function public.verify_cron_token(text) to service_role;

create or replace function public.call_sync_worker(path text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare t text; req bigint;
begin
  select decrypted_secret into t from vault.decrypted_secrets where name = 'worker_cron_token';
  select net.http_post(
    url := 'https://btbsmfaakcorhluvkytx.supabase.co/functions/v1/' || path,
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-token', t),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000) into req;
  return req;
end $$;
revoke all on function public.call_sync_worker(text) from public, anon, authenticated;

select cron.schedule('sync-pos', '0,30 * * * *', $$select public.call_sync_worker('sync?job=pos&days=2')$$);
select cron.schedule('sync-pancake', '5,35 * * * *', $$select public.call_sync_worker('sync?job=pancake&days=2')$$);
select cron.schedule('sync-meta', '10,40 * * * *', $$select public.call_sync_worker('sync-meta?days=2')$$);

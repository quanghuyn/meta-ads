create table public.meta_webhook_inbox (
 id uuid primary key default gen_random_uuid(),
 received_at timestamptz not null default now(),
 payload jsonb not null,
 payload_bytes integer not null check (payload_bytes between 0 and 1048576),
 status text not null default 'pending_mapping' check (status in ('pending_mapping','processed','rejected'))
);
alter table public.meta_webhook_inbox enable row level security;
revoke all on public.meta_webhook_inbox from anon, authenticated;
grant select, insert, update, delete on public.meta_webhook_inbox to service_role;
comment on table public.meta_webhook_inbox is 'Private webhook staging only. Not a reporting source. Review retention and mapping before production ingestion.';

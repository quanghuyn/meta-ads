create type app.job_status as enum ('queued', 'running', 'retry', 'succeeded', 'failed');

create table public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  connection_id uuid not null,
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,   -- không chứa token
  dedupe_key text not null,
  status app.job_status not null default 'queued',
  cursor jsonb,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_owner text,
  lease_until timestamptz,
  fencing_token bigint not null default 0,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, connection_id) references public.source_connections (workspace_id, id) on delete cascade
);
alter table public.sync_jobs enable row level security;
create unique index sync_jobs_active_dedupe on public.sync_jobs (workspace_id, connection_id, dedupe_key)
  where status in ('queued', 'running', 'retry');
create index sync_jobs_due_idx on public.sync_jobs (status, available_at);
create trigger sync_jobs_touch before update on public.sync_jobs
  for each row execute function app.touch_updated_at();

create table public.sync_checkpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  connection_id uuid not null,
  stream text not null,
  cursor jsonb,
  completed_through timestamptz,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique (workspace_id, connection_id, stream),
  foreign key (workspace_id, connection_id) references public.source_connections (workspace_id, id) on delete cascade
);
alter table public.sync_checkpoints enable row level security;

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid,
  action text not null,
  target_type text not null,
  target_id text,
  before_safe jsonb,
  after_safe jsonb,
  occurred_at timestamptz not null default now()
);
alter table public.audit_events enable row level security;
create index audit_events_idx on public.audit_events (workspace_id, occurred_at desc);

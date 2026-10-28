create type app.ad_entity_kind as enum ('account', 'campaign', 'adset', 'ad');

create table public.ad_entities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  connection_id uuid not null,
  kind app.ad_entity_kind not null,
  source_id text not null,
  parent_id uuid,
  name text,
  source_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, connection_id, kind, source_id),
  foreign key (workspace_id, connection_id) references public.source_connections (workspace_id, id) on delete cascade,
  foreign key (workspace_id, parent_id) references public.ad_entities (workspace_id, id)
);
alter table public.ad_entities enable row level security;
create index ad_entities_source_idx on public.ad_entities (workspace_id, kind, source_id);
create trigger ad_entities_touch before update on public.ad_entities
  for each row execute function app.touch_updated_at();

create table public.ad_query_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  connection_id uuid not null,
  profile_hash text not null,
  definition jsonb not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workspace_id, connection_id, profile_hash),
  foreign key (workspace_id, connection_id) references public.source_connections (workspace_id, id) on delete cascade
);
alter table public.ad_query_profiles enable row level security;
create unique index ad_query_profiles_one_active on public.ad_query_profiles (workspace_id, connection_id) where active;

create table public.ad_insights_daily (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  connection_id uuid not null,
  ad_entity_id uuid not null,
  source_date date not null,
  query_profile_hash text not null,
  spend numeric(20,4) not null check (spend >= 0),
  impressions bigint not null check (impressions >= 0),
  clicks_all bigint not null check (clicks_all >= 0),
  clicks_link bigint check (clicks_link >= 0),
  messaging_actions bigint check (messaging_actions >= 0),
  source_timezone text not null,
  currency text not null,
  synced_at timestamptz not null default now(),
  unique (workspace_id, connection_id, ad_entity_id, source_date, query_profile_hash),
  foreign key (workspace_id, connection_id) references public.source_connections (workspace_id, id) on delete cascade,
  foreign key (workspace_id, ad_entity_id) references public.ad_entities (workspace_id, id) on delete cascade,
  foreign key (workspace_id, connection_id, query_profile_hash)
    references public.ad_query_profiles (workspace_id, connection_id, profile_hash)
);
alter table public.ad_insights_daily enable row level security;
create index ad_insights_daily_date_idx on public.ad_insights_daily (workspace_id, source_date, ad_entity_id);

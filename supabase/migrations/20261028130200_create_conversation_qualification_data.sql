create type app.evidence_kind as enum ('tag', 'phone', 'referral');
create type app.eligibility as enum ('eligible', 'excluded', 'unknown');
create type app.history_quality as enum ('complete', 'snapshot', 'partial');
create type app.rule_state as enum ('draft', 'active', 'retired');
create type app.qualification_status as enum ('qualified', 'unqualified', 'pending', 'excluded');
create type app.attribution_bucket as enum ('paid', 'organic', 'other', 'unattributed');

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  connection_id uuid not null,
  source_id text not null,
  source_customer_id text,
  first_inbound_at timestamptz,            -- chưa kiểm chứng nguồn, thường null
  source_inserted_at timestamptz not null, -- inserted_at của Pancake (UTC); dùng làm ngày tạo hội thoại
  source_updated_at timestamptz,
  first_observed_at timestamptz not null default now(),
  has_phone boolean not null default false,
  eligibility app.eligibility not null default 'eligible',
  exclusion_reason text,
  history_quality app.history_quality not null default 'snapshot',
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, connection_id, source_id),
  foreign key (workspace_id, connection_id) references public.source_connections (workspace_id, id) on delete cascade
);
alter table public.conversations enable row level security;
create index conversations_created_idx on public.conversations (workspace_id, source_inserted_at);
create trigger conversations_touch before update on public.conversations
  for each row execute function app.touch_updated_at();

create table public.conversation_evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  conversation_id uuid not null,
  kind app.evidence_kind not null,
  dedupe_key text not null,
  value jsonb not null,
  evidence_at timestamptz,
  observed_at timestamptz not null,
  origin text not null default 'source' check (origin in ('source', 'manual')),
  active boolean not null default true,    -- false khi nhãn đã bị gỡ ở lần đồng bộ sau
  unique (workspace_id, conversation_id, dedupe_key),
  foreign key (workspace_id, conversation_id) references public.conversations (workspace_id, id) on delete cascade
);
alter table public.conversation_evidence enable row level security;

create table public.rule_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  version integer not null,
  state app.rule_state not null default 'draft',
  definition jsonb not null,
  effective_at timestamptz,
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, version),
  unique (workspace_id, id)
);
alter table public.rule_versions enable row level security;
create unique index rule_versions_one_active on public.rule_versions (workspace_id) where state = 'active';

create table public.qualification_results (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  conversation_id uuid not null,
  rule_version_id uuid not null,
  status app.qualification_status not null,
  predicate_results jsonb not null,
  evidence_cutoff_at timestamptz,
  effective_at timestamptz,
  evaluated_at timestamptz not null default now(),
  evaluation_hash text not null,
  override_by uuid references auth.users(id),
  override_reason text,
  unique (workspace_id, conversation_id, evaluation_hash),
  check (override_by is null or override_reason is not null),
  foreign key (workspace_id, conversation_id) references public.conversations (workspace_id, id) on delete cascade,
  foreign key (workspace_id, rule_version_id) references public.rule_versions (workspace_id, id)
);
alter table public.qualification_results enable row level security;
create index qualification_results_latest_idx on public.qualification_results (conversation_id, evaluated_at desc);

create table public.ad_touches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  conversation_id uuid not null,
  ad_entity_id uuid,
  source_ad_id text not null,
  touched_at timestamptz,
  observed_at timestamptz not null,
  source_event_key text not null,
  unique (workspace_id, id),
  unique (workspace_id, source_event_key),
  foreign key (workspace_id, conversation_id) references public.conversations (workspace_id, id) on delete cascade,
  foreign key (workspace_id, ad_entity_id) references public.ad_entities (workspace_id, id)
);
alter table public.ad_touches enable row level security;
create index ad_touches_conv_idx on public.ad_touches (conversation_id, touched_at desc);

create table public.conversation_attributions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  conversation_id uuid not null,
  ad_touch_id uuid,
  bucket app.attribution_bucket not null,
  method text not null,
  reason text,
  attribution_version integer not null,
  active boolean not null default true,
  decided_at timestamptz not null default now(),
  foreign key (workspace_id, conversation_id) references public.conversations (workspace_id, id) on delete cascade,
  foreign key (workspace_id, ad_touch_id) references public.ad_touches (workspace_id, id),
  check ((bucket = 'paid') = (ad_touch_id is not null))
);
alter table public.conversation_attributions enable row level security;
create unique index conversation_attributions_one_active on public.conversation_attributions (workspace_id, conversation_id) where active;

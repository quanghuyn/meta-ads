create table public.orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  connection_id uuid not null,
  source_id text not null,
  source_customer_id text,
  source_conversation_id text,
  source_ad_id text,
  order_created_at timestamptz not null,
  source_updated_at timestamptz,
  source_status text not null,
  source_deleted_at timestamptz,
  currency text not null,
  amount_components jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, connection_id, source_id),
  foreign key (workspace_id, connection_id) references public.source_connections (workspace_id, id) on delete cascade
);
alter table public.orders enable row level security;
create index orders_created_idx on public.orders (workspace_id, order_created_at);
create trigger orders_touch before update on public.orders
  for each row execute function app.touch_updated_at();

create table public.order_total_sale_facts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  order_id uuid not null,
  contract_version integer not null,
  source_fact_key text not null,
  recognition_date date not null,
  included boolean not null,
  amount numeric(20,4) not null,
  currency text not null,
  reason text,
  unique (workspace_id, order_id, contract_version, source_fact_key),
  foreign key (workspace_id, order_id) references public.orders (workspace_id, id) on delete cascade
);
alter table public.order_total_sale_facts enable row level security;
create index order_total_sale_facts_date_idx on public.order_total_sale_facts (workspace_id, contract_version, recognition_date);

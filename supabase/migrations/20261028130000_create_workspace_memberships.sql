-- Workspace, thành viên, kết nối nguồn. RLS bật ngay khi tạo bảng.
create schema if not exists app;

create type app.member_role as enum ('admin', 'marketing', 'sales');
create type app.provider as enum ('meta', 'inbox', 'pos');
create type app.connection_state as enum ('not_configured', 'active', 'disabled', 'error');

create function app.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_timezone text not null default 'Asia/Ho_Chi_Minh',
  currency text not null default 'VND',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.workspaces enable row level security;
create trigger workspaces_touch before update on public.workspaces
  for each row execute function app.touch_updated_at();

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role app.member_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
alter table public.memberships enable row level security;
create trigger memberships_touch before update on public.memberships
  for each row execute function app.touch_updated_at();

-- Kiểm tra quyền theo membership hiện hành; dùng trong policy và RPC.
create function app.has_role(p_workspace_id uuid, p_roles app.member_role[])
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.workspace_id = p_workspace_id
      and m.user_id = (select auth.uid())
      and m.active
      and m.role = any (p_roles)
  )
$$;
revoke all on function app.has_role(uuid, app.member_role[]) from public;
grant execute on function app.has_role(uuid, app.member_role[]) to authenticated, service_role;
grant usage on schema app to authenticated, service_role;

create table public.source_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider app.provider not null,
  source_id text not null,
  name text,
  credential_ref text,              -- tên secret được phép, không chứa token
  state app.connection_state not null default 'not_configured',
  last_success_at timestamptz,
  source_timezone text,
  currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider, source_id),
  unique (workspace_id, id)
);
alter table public.source_connections enable row level security;
create trigger source_connections_touch before update on public.source_connections
  for each row execute function app.touch_updated_at();

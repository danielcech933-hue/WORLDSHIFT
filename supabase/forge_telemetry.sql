-- ROBLOX FORGE telemetry schema
-- Run this in the Supabase SQL editor for the project used by FORGE.

create table if not exists public.forge_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_name text not null default 'WORLDSHIFT',
  project_root text,
  source text not null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('debug','info','warn','error')),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists forge_events_created_at_idx on public.forge_events (created_at desc);
create index if not exists forge_events_project_idx on public.forge_events (project_name, created_at desc);
create index if not exists forge_events_type_idx on public.forge_events (event_type, created_at desc);

alter table public.forge_events enable row level security;

-- The desktop FORGE client only needs to INSERT telemetry. Reads remain private.
drop policy if exists "forge telemetry insert" on public.forge_events;
create policy "forge telemetry insert"
on public.forge_events
for insert
to anon, authenticated
with check (
  length(project_name) between 1 and 120
  and length(source) between 1 and 80
  and length(event_type) between 1 and 120
);

-- Optional server-side retention helper. Call manually or from a scheduled job.
create or replace function public.prune_forge_events(retention_days integer default 30)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count bigint;
begin
  delete from public.forge_events
  where created_at < now() - make_interval(days => greatest(retention_days, 1));
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

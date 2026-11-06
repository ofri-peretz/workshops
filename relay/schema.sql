-- Relay's Supabase schema (project relay-workshop, eu-central-1), mirrored from the live database
-- on 2026-10-26. Change the database with a migration, then update this file; test.mjs checks that
-- every event kind the handler writes is allowed by relay_events_kind_check below.

create table public.relay_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  phone text check (phone is null or phone ~ '^[0-9a-f-]{36}$'),
  kind text not null,
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 2048),
  constraint relay_events_kind_check
    check (kind = any (array['join','send','rtt','answer','request','job','load','control','curious']))
);
alter table public.relay_events enable row level security;
create policy relay_events_read on public.relay_events for select to anon using (true);
create policy relay_events_append on public.relay_events for insert to anon with check (true);

create table public.relay_counter (id integer primary key check (id = 1), n integer not null default 0);
alter table public.relay_counter enable row level security; -- no policies: only relay_bump touches it
insert into public.relay_counter (id) values (1);

-- The load scenes' in-flight counter: moves by at most ±1 per call, never below 0.
create or replace function public.relay_bump(d integer) returns integer
language sql security definer set search_path to '' as $$
  update public.relay_counter set n = greatest(0, n + least(greatest(d, -1), 1)) where id = 1 returning n;
$$;

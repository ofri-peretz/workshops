-- Relay's Supabase schema (Supabase project relay-workshop; Vercel project workshop; eu-central-1), mirrored from the live database
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

-- Access: see migrations/20261106_relay_access.sql (applied 2026-11-06).
create table public.relay_access (
  id integer primary key default 1 check (id = 1),
  owner uuid not null,                 -- the presenter's auth.users id
  opened_at timestamptz,
  live_until timestamptz,              -- closed when null or past (Close sets it to now())
  join_until timestamptz,              -- the join code stops admitting new phones here
  code_hmac text,                      -- HMAC-SHA256(code, CODE_SECRET), hex
  locked boolean not null default false -- too many wrong tries room-wide; Go live again to reopen
);
alter table public.relay_access enable row level security;
create policy relay_access_owner on public.relay_access for all to authenticated
  using (auth.uid() = owner) with check (auth.uid() = owner);

create table public.relay_join_failures (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  ip_hash text not null
);
alter table public.relay_join_failures enable row level security; -- no policies: functions only
create index relay_join_failures_at on public.relay_join_failures (at);

-- Is the room live? Safe for anyone: no code, no hash.
create or replace function public.relay_gate() returns table (live boolean, joinable boolean, locked boolean, opened_at timestamptz)
language sql stable security definer set search_path to '' as $$
  select coalesce(a.live_until > now(), false), coalesce(a.live_until > now() and a.join_until > now() and not a.locked, false),
         a.locked, a.opened_at
  from public.relay_access a where a.id = 1;
$$;

-- One join attempt. Returns ok | wrong | rate_limited | locked | expired | closed.
-- Comparing HMACs (not codes) means a timing difference reveals nothing about the code.
create or replace function public.relay_try_join(p_hmac text, p_ip text) returns text
language plpgsql security definer set search_path to '' as $$
declare a public.relay_access; ip_fails int; room_fails int;
begin
  select * into a from public.relay_access where id = 1 for update;
  if a is null or a.live_until is null or a.live_until <= now() then return 'closed'; end if;
  if a.locked then return 'locked'; end if;
  if a.join_until <= now() then return 'expired'; end if;
  select count(*) into ip_fails from public.relay_join_failures
    where ip_hash = p_ip and at >= greatest(now() - interval '10 minutes', a.opened_at);
  if ip_fails >= 5 then return 'rate_limited'; end if;
  if a.code_hmac = p_hmac then return 'ok'; end if;
  insert into public.relay_join_failures (ip_hash) values (p_ip);
  select count(*) into room_fails from public.relay_join_failures
    where at >= greatest(now() - interval '10 minutes', a.opened_at);
  if room_fails >= 30 then update public.relay_access set locked = true where id = 1; return 'locked'; end if;
  return 'wrong';
end $$;

revoke all on function public.relay_gate() from public;
revoke all on function public.relay_try_join(text, text) from public;
grant execute on function public.relay_gate() to anon, authenticated;
grant execute on function public.relay_try_join(text, text) to anon;

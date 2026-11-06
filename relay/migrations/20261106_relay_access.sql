-- The room is closed unless the presenter opened it. Only the presenter's signed-in user may change
-- relay_access (RLS); phones only reach it through the two functions below, which never return the
-- code's hash.

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

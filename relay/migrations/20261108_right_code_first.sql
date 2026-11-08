-- The right code always gets in. A venue's 50 phones share one public IP, so five typos must not lock
-- out everyone else on that network; the per-network limit now only slows wrong guesses. The room-wide
-- lock (30 wrong codes in 10 minutes) still stops guessing.
create or replace function public.relay_try_join(p_hmac text, p_ip text) returns text
language plpgsql security definer set search_path to '' as $$
declare a public.relay_access; ip_fails int; room_fails int;
begin
  select * into a from public.relay_access where id = 1 for update;
  if a is null or a.live_until is null or a.live_until <= now() then return 'closed'; end if;
  if a.locked then return 'locked'; end if;
  if a.join_until <= now() then return 'expired'; end if;
  if a.code_hmac = p_hmac then return 'ok'; end if;
  select count(*) into ip_fails from public.relay_join_failures
    where ip_hash = p_ip and at >= greatest(now() - interval '10 minutes', a.opened_at);
  if ip_fails >= 5 then return 'rate_limited'; end if;
  insert into public.relay_join_failures (ip_hash) values (p_ip);
  select count(*) into room_fails from public.relay_join_failures
    where at >= greatest(now() - interval '10 minutes', a.opened_at);
  if room_fails >= 30 then update public.relay_access set locked = true where id = 1; return 'locked'; end if;
  return 'wrong';
end $$;
revoke all on function public.relay_try_join(text, text) from public;
grant execute on function public.relay_try_join(text, text) to anon;

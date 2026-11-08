-- Lock the event log to the relay's server key, and keep typed text no longer than it is useful.
-- 1. The relay's functions run under its server key (service_role) too; the console keeps its owner policy.
grant execute on function public.relay_gate() to service_role;
grant execute on function public.relay_try_join(text, text) to service_role;
grant execute on function public.relay_bump(integer) to service_role;
-- 2. Applied after the relay switched to its server key: nobody else reads or writes the log.
drop policy if exists relay_events_read on public.relay_events;
drop policy if exists relay_events_append on public.relay_events;
revoke all on public.relay_events from anon, authenticated;
revoke all on public.relay_join_failures from anon, authenticated;
-- 3. Names and questions people typed are removed 30 days after the session; counts and answers stay.
create extension if not exists pg_cron with schema extensions;
select cron.schedule('relay-purge-typed-text', '15 3 * * *', $$
  update public.relay_events
     set data = jsonb_set(data, '{value}', '"(removed after 30 days)"')
   where kind = 'answer'
     and data->>'scene' in ('_name', '_ask')
     and (data->>'t')::bigint < (extract(epoch from now()) * 1000)::bigint - 30::bigint * 86400000
     and data->>'value' is distinct from '(removed after 30 days)'
$$);

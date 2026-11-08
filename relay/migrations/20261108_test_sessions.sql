-- Test sessions: a run started with test=true, or tagged later (control op "tag": i = the run's start id,
-- test = true/false; the last tag wins). Seven days after a test run started, its events are deleted:
-- from its start up to the next run's start. The newest run is never touched; real runs never are.
create or replace function public.relay_purge_test_runs() returns integer
language plpgsql security definer set search_path to '' as $$
declare n int := 0; r record;
begin
  for r in
    with starts as (
      select id, (data->>'t')::bigint as t, coalesce((data->>'test')::boolean, false) as test,
             lead(id) over (order by id) as next_id
        from public.relay_events where kind = 'control' and data->>'op' = 'start'),
    tags as (
      select distinct on ((data->>'i')::bigint) (data->>'i')::bigint as run, (data->>'test')::boolean as test
        from public.relay_events where kind = 'control' and data->>'op' = 'tag'
       order by (data->>'i')::bigint, id desc)
    select s.id, s.next_id from starts s left join tags g on g.run = s.id
     where coalesce(g.test, s.test)
       and s.next_id is not null
       and s.t < (extract(epoch from now()) * 1000)::bigint - 7::bigint * 86400000
  loop
    delete from public.relay_events where id >= r.id and id < r.next_id;
    delete from public.relay_events where kind = 'control' and data->>'op' = 'tag' and (data->>'i')::bigint = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.relay_purge_test_runs() from public, anon, authenticated;
select cron.schedule('relay-purge-test-runs', '30 3 * * *', $$ select public.relay_purge_test_runs() $$);

-- Relay's database moved from project relay-workshop (nzlbondrpvbgxcksbarb, eu-central-1) to ofri-and-interlace-data
-- (xzhsvszshidjhfnsstmg, us-west-1) so the free-plan slot can be reused. Applied there as four migrations:
-- relay_pg_cron_extension, relay_schema (every migration above, in their final state), relay_cron_jobs, and a one-off
-- data copy (ids kept, identities reset to max(id)). The data copy and its checks are in the pull request.
--
-- Differences from the old project, on purpose:
--   * relay_bump(integer) is executable by service_role only (it was also open to anon by default; the relay uses its server key).
--   * relay_access: no table grants for anon (RLS already refused it); the owner policy reads (select auth.uid()).
--   * the partial index relay_events_control (id) where kind = 'control' exists in both, and is now written down.
--
-- After the presenter signs in once on the new project, point relay_access at the new user (the old id is copied as-is):
--   update public.relay_access set owner = (select id from auth.users where lower(email) = lower('<owner email>')) where id = 1;
create extension if not exists pg_cron with schema extensions;
create index if not exists relay_events_control on public.relay_events (id) where kind = 'control';

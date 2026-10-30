-- Change only the existing Pancake job; preserve command/authentication and all other jobs.
-- pg_cron timezone is GMT on this project: 00:05/06:05/12:05/18:05 UTC = 07:05/13:05/19:05/01:05 Vietnam.
do $$
declare j record;
begin
 if (select count(*) from cron.job where jobname='sync-pancake' and username=current_user) <> 1 then
  raise exception 'expected_exactly_one_owned_pancake_job';
 end if;
 select jobname,command into j from cron.job where jobname='sync-pancake' and username=current_user;
 perform cron.schedule(j.jobname,'5 */6 * * *',j.command);
end $$;

-- Owner request: POS every 60 minutes; preserve the job command and other schedules.
-- Fail closed if the named POS job is missing or owned by a different database user.
do $$
declare j record;
begin
 select * into strict j from cron.job where jobname='sync-pos' and username=current_user;
 perform cron.schedule(j.jobname,'0 * * * *',j.command);
end $$;

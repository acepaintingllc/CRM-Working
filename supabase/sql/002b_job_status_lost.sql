-- Run this in its own SQL execution.
alter type public.job_status add value if not exists 'lost';

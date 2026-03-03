alter table public.jobs
  add column if not exists scheduled_email_sent_at timestamptz;

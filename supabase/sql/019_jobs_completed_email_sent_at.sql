alter table public.jobs
  add column if not exists completed_email_sent_at timestamptz;

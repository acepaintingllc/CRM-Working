-- Phase 6: Add pricing policy fields to estimate_jobsettings
-- labor_day_policy_enabled: controls whether the 1-day minimum / rounding policy applies
-- job_minimum_enabled: controls whether the job minimum price floor applies
-- job_minimum_amount: the minimum dollar amount for the estimate

ALTER TABLE estimate_jobsettings
  ADD COLUMN IF NOT EXISTS labor_day_policy_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS job_minimum_enabled      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS job_minimum_amount       numeric(10,2);

-- Retire the old piecemeal Estimator V2 save RPC.
-- Current saves use public.save_estimate_v2_full_persistence exclusively.

drop function if exists public.save_estimate_v2_inputs(uuid, uuid, uuid, jsonb);

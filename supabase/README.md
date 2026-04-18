# Supabase Notes

## Purpose

This folder contains SQL migrations and Supabase-related project artifacts.

## Current Convention

- SQL migrations live in `supabase/sql`
- migrations use numeric prefixes
- estimator work should continue using additive, clearly named migrations

## Estimator Rule

For the in-app estimator rebuild:

- do not create migrations until the phase requires a real schema change
- prefer explicit, reversible changes
- keep RLS and indexes in the same migration when adding new estimator tables

## Recommended Migration Naming

- `040_estimator_v2_<feature>.sql`
- `041_estimator_v2_<feature>.sql`

Examples:

- `040_estimator_v2_materials_tables.sql`
- `041_estimator_v2_summary_rollups.sql`

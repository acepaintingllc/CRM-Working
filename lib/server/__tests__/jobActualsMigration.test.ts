import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const migrationPath = path.resolve(process.cwd(), 'supabase/sql/081_job_actuals.sql')
const migrationSql = readFileSync(migrationPath, 'utf8')

test('job actuals migration creates job_actuals table with snapshot scope fields', () => {
  assert.match(migrationSql, /create table if not exists public\.job_actuals/i)
  assert.match(migrationSql, /org_id uuid not null references public\.orgs\(id\)/i)
  assert.match(migrationSql, /job_id uuid not null references public\.jobs\(id\)/i)
  assert.match(
    migrationSql,
    /estimate_snapshot_id uuid not null references public\.estimate_snapshot\(id\)/i
  )
  assert.match(migrationSql, /status text not null default 'draft'/i)
})

test('job actuals migration prevents duplicate actuals for the same snapshot', () => {
  assert.match(
    migrationSql,
    /constraint job_actuals_org_job_snapshot_uniq[\s\S]*unique \(org_id, job_id, estimate_snapshot_id\)/i
  )
  assert.match(
    migrationSql,
    /constraint job_actuals_snapshot_scope_fkey[\s\S]*foreign key \(estimate_snapshot_id, org_id, job_id\)/i
  )
  assert.match(
    migrationSql,
    /references public\.estimate_snapshot \(id, org_id, job_id\)/i
  )
})

test('job actuals migration constrains status timestamps and non-negative values', () => {
  assert.match(migrationSql, /check \(actual_labor_hours >= 0\)/i)
  assert.match(migrationSql, /check \(actual_paint_gallons >= 0\)/i)
  assert.match(migrationSql, /check \(actual_supplies_cost >= 0\)/i)
  assert.match(migrationSql, /check \(actual_other_cost >= 0\)/i)
  assert.match(migrationSql, /status in \('draft', 'submitted', 'locked'\)/i)
  assert.match(migrationSql, /status = 'draft' or submitted_at is not null/i)
  assert.match(migrationSql, /status <> 'locked' or locked_at is not null/i)
})

test('job actuals migration makes locked actuals immutable', () => {
  assert.match(migrationSql, /create or replace function public\.prevent_locked_job_actual_mutation/i)
  assert.match(migrationSql, /if old\.status = 'locked' then/i)
  assert.match(migrationSql, /before update on public\.job_actuals/i)
  assert.match(migrationSql, /before delete on public\.job_actuals/i)
})

test('job actuals migration applies org-scoped RLS policies', () => {
  assert.match(migrationSql, /alter table public\.job_actuals enable row level security/i)
  assert.match(migrationSql, /create policy job_actuals_select/i)
  assert.match(migrationSql, /create policy job_actuals_insert/i)
  assert.match(migrationSql, /create policy job_actuals_update/i)
  assert.match(migrationSql, /from public\.org_members m/i)
  assert.match(migrationSql, /m\.user_id = auth\.uid\(\)/i)
})

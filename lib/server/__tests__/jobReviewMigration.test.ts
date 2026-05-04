import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const migrationPath = path.resolve(process.cwd(), 'supabase/sql/082_job_review.sql')
const migrationSql = readFileSync(migrationPath, 'utf8')

test('job review migration creates review and metric tables', () => {
  assert.match(migrationSql, /create table if not exists public\.job_review/i)
  assert.match(migrationSql, /create table if not exists public\.job_review_metric/i)
  assert.match(migrationSql, /estimate_snapshot_id uuid not null references public\.estimate_snapshot\(id\)/i)
  assert.match(migrationSql, /job_actuals_id uuid not null references public\.job_actuals\(id\)/i)
})

test('job review migration enforces one review per job snapshot', () => {
  assert.match(
    migrationSql,
    /constraint job_review_org_job_snapshot_uniq[\s\S]*unique \(org_id, job_id, estimate_snapshot_id\)/i
  )
  assert.match(migrationSql, /constraint job_actuals_identity_scope_uniq/i)
  assert.match(migrationSql, /constraint job_review_identity_scope_uniq/i)
  assert.match(
    migrationSql,
    /constraint job_review_snapshot_scope_fkey[\s\S]*foreign key \(estimate_snapshot_id, org_id, job_id\)/i
  )
  assert.match(
    migrationSql,
    /constraint job_review_metric_review_scope_fkey[\s\S]*foreign key \(job_review_id, org_id, job_id, estimate_snapshot_id\)/i
  )
})

test('job review migration stores review status and data quality fields', () => {
  assert.match(migrationSql, /status text not null default 'draft'/i)
  assert.match(migrationSql, /status in \('draft', 'reviewed', 'locked'\)/i)
  assert.match(migrationSql, /exclude_from_trends boolean not null default false/i)
  assert.match(migrationSql, /data_quality_status text not null default 'valid'/i)
  assert.match(migrationSql, /data_quality_status in \('valid', 'questionable', 'invalid'\)/i)
  assert.match(migrationSql, /change_order_present boolean not null default false/i)
})

test('job review migration exposes locked valid non-excluded trend eligibility', () => {
  assert.match(migrationSql, /trend_eligible boolean generated always as/i)
  assert.match(migrationSql, /status = 'locked'/i)
  assert.match(migrationSql, /data_quality_status = 'valid'/i)
  assert.match(migrationSql, /exclude_from_trends = false/i)
  assert.match(migrationSql, /where trend_eligible = true/i)
})

test('job review migration stores variance metric fields', () => {
  assert.match(migrationSql, /metric_key text not null/i)
  assert.match(migrationSql, /metric_key in \('labor', 'paint', 'supplies', 'other'\)/i)
  assert.match(migrationSql, /estimated_value numeric not null default 0/i)
  assert.match(migrationSql, /actual_value numeric not null default 0/i)
  assert.match(migrationSql, /variance_value numeric not null default 0/i)
  assert.match(migrationSql, /total_impact numeric not null default 0/i)
  assert.match(migrationSql, /variance_percent numeric null/i)
  assert.match(migrationSql, /within_tolerance boolean not null default false/i)
})

test('job review migration makes locked reviews and metrics immutable', () => {
  assert.match(migrationSql, /create or replace function public\.prevent_locked_job_review_mutation/i)
  assert.match(migrationSql, /if old\.status = 'locked' then/i)
  assert.match(migrationSql, /before update on public\.job_review/i)
  assert.match(migrationSql, /before delete on public\.job_review/i)
  assert.match(migrationSql, /prevent_locked_job_review_metric_mutation/i)
  assert.match(migrationSql, /locked job review metrics are immutable/i)
})

test('job review migration applies org-scoped RLS policies', () => {
  assert.match(migrationSql, /alter table public\.job_review enable row level security/i)
  assert.match(migrationSql, /alter table public\.job_review_metric enable row level security/i)
  assert.match(migrationSql, /create policy job_review_select/i)
  assert.match(migrationSql, /create policy job_review_insert/i)
  assert.match(migrationSql, /create policy job_review_update/i)
  assert.match(migrationSql, /create policy job_review_metric_select/i)
  assert.match(migrationSql, /from public\.org_members m/i)
  assert.match(migrationSql, /m\.user_id = auth\.uid\(\)/i)
})

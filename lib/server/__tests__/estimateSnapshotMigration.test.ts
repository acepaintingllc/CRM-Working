import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/sql/079_estimate_snapshot_tables.sql'
)
const migrationSql = readFileSync(migrationPath, 'utf8')
const prejobMigrationPath = path.resolve(
  process.cwd(),
  'supabase/sql/091_estimate_snapshot_prejob_line_kind.sql'
)
const prejobMigrationSql = readFileSync(prejobMigrationPath, 'utf8')

test('estimate snapshot migration creates snapshot and line tables', () => {
  assert.match(migrationSql, /create table if not exists public\.estimate_snapshot/i)
  assert.match(migrationSql, /create table if not exists public\.estimate_snapshot_line/i)
  assert.match(migrationSql, /accepted_public_version_id uuid null references public\.estimate_public_versions\(id\)/i)
  assert.match(migrationSql, /setting_set_id_used uuid null references public\.estimator_setting_set\(id\)/i)
  assert.match(migrationSql, /source_payload_json jsonb not null default '\{\}'::jsonb/i)
})

test('estimate snapshot migration enforces v1 snapshot and line uniqueness', () => {
  assert.match(migrationSql, /unique \(org_id, estimate_id\)/i)
  assert.match(migrationSql, /unique \(snapshot_id, line_key\)/i)
  assert.match(
    migrationSql,
    /constraint estimate_snapshot_line_snapshot_scope_fkey[\s\S]*foreign key \(snapshot_id, org_id, job_id, estimate_id\)/i
  )
})

test('estimate snapshot base migration constrains snapshot reasons and original line kinds', () => {
  assert.match(migrationSql, /snapshot_created_reason in \('accepted', 'manual_sold', 'backfill'\)/i)
  assert.match(
    migrationSql,
    /line_kind in \('walls', 'ceilings', 'trim', 'doors', 'drywall', 'other', 'access', 'policy', 'summary'\)/i
  )
})

test('estimate snapshot follow-up migration adds prejob to the accepted line-kind contract', () => {
  assert.match(prejobMigrationSql, /drop constraint if exists estimate_snapshot_line_line_kind_check/i)
  assert.match(
    prejobMigrationSql,
    /line_kind in \([\s\S]*'walls'[\s\S]*'ceilings'[\s\S]*'trim'[\s\S]*'doors'[\s\S]*'drywall'[\s\S]*'other'[\s\S]*'access'[\s\S]*'prejob'[\s\S]*'policy'[\s\S]*'summary'[\s\S]*\)/i
  )
})

test('estimate snapshot migration applies immutable trigger guards', () => {
  assert.match(migrationSql, /create or replace function public\.prevent_estimate_snapshot_mutation/i)
  assert.match(migrationSql, /before update on public\.estimate_snapshot/i)
  assert.match(migrationSql, /before delete on public\.estimate_snapshot/i)
  assert.match(migrationSql, /before update on public\.estimate_snapshot_line/i)
  assert.match(migrationSql, /before delete on public\.estimate_snapshot_line/i)
})

test('estimate snapshot migration applies org-scoped indexes and RLS policies', () => {
  assert.match(migrationSql, /estimate_snapshot_org_job_idx[\s\S]*\(org_id, job_id, created_at desc\)/i)
  assert.match(migrationSql, /estimate_snapshot_org_accepted_public_version_idx[\s\S]*\(org_id, accepted_public_version_id\)/i)
  assert.match(migrationSql, /estimate_snapshot_org_setting_set_idx[\s\S]*\(org_id, setting_set_id_used\)/i)
  assert.match(migrationSql, /alter table public\.estimate_snapshot enable row level security/i)
  assert.match(migrationSql, /alter table public\.estimate_snapshot_line enable row level security/i)
  assert.match(migrationSql, /from public\.org_members m/i)
  assert.match(migrationSql, /m\.user_id = auth\.uid\(\)/i)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/sql/077_estimator_setting_sets.sql'
)
const migrationSql = readFileSync(migrationPath, 'utf8')

test('estimator setting sets migration creates versioned settings tables', () => {
  assert.match(migrationSql, /create table if not exists public\.estimator_setting_set/i)
  assert.match(migrationSql, /create table if not exists public\.estimator_setting_value/i)
  assert.match(migrationSql, /create table if not exists public\.setting_change_log/i)
  assert.match(
    migrationSql,
    /alter table public\.estimates\s+add column if not exists setting_set_id_used uuid null/i
  )
})

test('estimator setting sets migration enforces active-set and value uniqueness', () => {
  assert.match(
    migrationSql,
    /create unique index if not exists estimator_setting_set_one_active_per_org_idx[\s\S]*where status = 'active'/i
  )
  assert.match(
    migrationSql,
    /create unique index if not exists estimator_setting_value_set_category_key_idx[\s\S]*coalesce\(row_id, scalar_key\)/i
  )
  assert.match(
    migrationSql,
    /constraint estimator_setting_value_key_check[\s\S]*row_id is not null and scalar_key is null[\s\S]*row_id is null and scalar_key is not null/i
  )
})

test('estimator setting sets migration backfills active sets, scalar defaults, rate rows, and estimates', () => {
  assert.match(migrationSql, /from public\.estimate_template_settings/i)
  assert.match(migrationSql, /from public\.estimator_template_constants/i)
  assert.match(migrationSql, /'scalar_defaults'::text as category_key/i)
  assert.match(migrationSql, /jsonb_each\(to_jsonb\(settings\) - 'org_id' - 'updated_at'\)/i)
  assert.match(migrationSql, /from public\.estimator_template_constant_rows rows/i)
  assert.match(
    migrationSql,
    /update public\.estimates estimates[\s\S]*set setting_set_id_used = active_sets\.id/i
  )
})

test('estimator setting sets migration applies org-member RLS policies', () => {
  assert.match(migrationSql, /alter table public\.estimator_setting_set enable row level security/i)
  assert.match(migrationSql, /alter table public\.estimator_setting_value enable row level security/i)
  assert.match(migrationSql, /alter table public\.setting_change_log enable row level security/i)
  assert.match(migrationSql, /from public\.org_members m/i)
  assert.match(migrationSql, /m\.user_id = auth\.uid\(\)/i)
})

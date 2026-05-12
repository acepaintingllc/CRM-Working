import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/sql/097_global_settings_publish_moves_draft_estimates.sql'
)
const migrationSql = readFileSync(migrationPath, 'utf8')

test('global settings publish migration moves only draft estimate versions', () => {
  assert.match(
    migrationSql,
    /create or replace function public\.activate_estimator_setting_set/i
  )
  assert.match(migrationSql, /update public\.estimates/i)
  assert.match(migrationSql, /version_state = 'draft'/i)
  assert.doesNotMatch(migrationSql, /version_state\s+in\s+\(/i)
  assert.match(migrationSql, /setting_set_id_used = p_setting_set_id/i)
  assert.match(migrationSql, /draft_estimates_updated/i)
})

test('rates flags batch publish is a single atomic database function', () => {
  assert.match(
    migrationSql,
    /create or replace function public\.publish_estimator_rates_flags_batch/i
  )
  assert.match(migrationSql, /p_mutations jsonb/i)
  assert.match(migrationSql, /jsonb_array_elements\(p_mutations\)/i)
  assert.match(migrationSql, /perform pg_advisory_xact_lock/i)
  assert.match(migrationSql, /insert into public\.estimator_setting_set/i)
  assert.match(migrationSql, /insert into public\.estimator_setting_value/i)
  assert.match(migrationSql, /update public\.estimator_setting_set[\s\S]*status = 'active'/i)
  assert.match(migrationSql, /update public\.estimates[\s\S]*version_state = 'draft'/i)
  assert.match(
    migrationSql,
    /grant execute on function public\.publish_estimator_rates_flags_batch\(uuid, uuid, jsonb, text, text\) to service_role/i
  )
  assert.match(
    migrationSql,
    /revoke all on function public\.publish_estimator_rates_flags_batch\(uuid, uuid, jsonb, text, text\) from authenticated/i
  )
})

test('rates flags batch publish validates before cloning', () => {
  const validationIndex = migrationSql.search(
    /for v_mutation in select value from jsonb_array_elements\(p_mutations\)/i
  )
  const cloneIndex = migrationSql.search(/insert into public\.estimator_setting_set/i)
  assert.ok(validationIndex >= 0, 'Expected mutation validation loop.')
  assert.ok(cloneIndex >= 0, 'Expected setting set clone insert.')
  assert.ok(validationIndex < cloneIndex, 'Expected validation before setting set clone.')
  assert.match(migrationSql, /raise exception 'Row not found\.'/i)
  assert.match(migrationSql, /raise exception 'Row "%" already exists\.'/i)
})

test('global settings publish migration keeps activation service-role scoped', () => {
  assert.match(
    migrationSql,
    /grant execute on function public\.activate_estimator_setting_set\(uuid, uuid, uuid, text, text\) to service_role/i
  )
  assert.match(
    migrationSql,
    /revoke all on function public\.activate_estimator_setting_set\(uuid, uuid, uuid, text, text\) from authenticated/i
  )
})

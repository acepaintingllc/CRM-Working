import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/sql/080_estimate_feedback_atomic_rpcs.sql'
)
const migrationSql = readFileSync(migrationPath, 'utf8')

test('estimate feedback atomic RPC migration inserts snapshots and lines together', () => {
  assert.match(
    migrationSql,
    /create or replace function public\.insert_estimate_snapshot_with_lines/i
  )
  assert.match(migrationSql, /insert into public\.estimate_snapshot \(/i)
  assert.match(migrationSql, /insert into public\.estimate_snapshot_line \(/i)
  assert.match(migrationSql, /snapshot must include summary:job-total line/i)
  assert.match(migrationSql, /existing estimate snapshot is incomplete/i)
  assert.match(migrationSql, /when unique_violation then/i)
})

test('estimate feedback atomic RPC migration activates setting sets transactionally', () => {
  assert.match(
    migrationSql,
    /create or replace function public\.activate_estimator_setting_set/i
  )
  assert.match(migrationSql, /for update/i)
  assert.match(migrationSql, /status = 'retired'/i)
  assert.match(migrationSql, /status = 'active'/i)
  assert.match(migrationSql, /insert into public\.setting_change_log/i)
  assert.match(migrationSql, /'setting_set\.activation'/i)
})

test('estimate feedback atomic RPC migration grants service-role execution only', () => {
  assert.match(
    migrationSql,
    /grant execute on function public\.insert_estimate_snapshot_with_lines\(jsonb, jsonb\) to service_role/i
  )
  assert.match(
    migrationSql,
    /grant execute on function public\.activate_estimator_setting_set\(uuid, uuid, uuid, text, text\) to service_role/i
  )
})

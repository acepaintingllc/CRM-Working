import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/sql/087_estimator_v2_full_save_rpc_v2_roster_only.sql'
)
const dropLegacyRpcMigrationPath = path.resolve(
  process.cwd(),
  'supabase/sql/088_drop_legacy_estimate_v2_inputs_rpc.sql'
)
const migrationSql = readFileSync(migrationPath, 'utf8')
const dropLegacyRpcMigrationSql = readFileSync(dropLegacyRpcMigrationPath, 'utf8')

function compactSql(sql: string) {
  return sql.toLowerCase().replace(/\s+/g, ' ')
}

test('full save rpc migration removes the legacy room replace branch', () => {
  const sql = compactSql(migrationSql)

  assert.match(sql, /create or replace function public\.save_estimate_v2_full_persistence/)
  assert.match(sql, /room persistence is v2 roster-only/)
  assert.match(sql, /coalesce\(p_payload->>'room_save_mode', 'v2_roster'\) <> 'v2_roster'/)
  assert.match(sql, /unsupported room_save_mode for estimate v2 full persistence/)

  assert.doesNotMatch(sql, /legacy_replace/)
  assert.doesNotMatch(sql, /p_payload \? 'segments'/)
  assert.doesNotMatch(sql, /p_payload \? 'ceiling_segments'/)
  assert.doesNotMatch(sql, /estimate_ceiling_segments/)
  assert.doesNotMatch(
    sql,
    /delete from public\.estimate_rooms where org_id = p_org_id and estimate_id = p_estimate_id/
  )
})

test('full save rpc migration keeps v2 roster stale-room cleanup', () => {
  const sql = compactSql(migrationSql)

  assert.match(sql, /with input_rooms as/)
  assert.match(sql, /matched_rooms as/)
  assert.match(sql, /delete from public\.estimate_rooms existing/)
  assert.match(sql, /from matched_rooms matched where matched\.id = existing\.id/)
  assert.match(sql, /from matched_rooms on conflict \(id\)/)
})

test('legacy piecemeal save rpc is dropped after full-save migration', () => {
  const sql = compactSql(dropLegacyRpcMigrationSql)

  assert.match(sql, /drop function if exists public\.save_estimate_v2_inputs\(uuid, uuid, uuid, jsonb\)/)
})

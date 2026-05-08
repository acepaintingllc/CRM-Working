import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/sql/086_migrate_legacy_estimate_rooms_to_v2_scopes.sql'
)
const migrationSql = readFileSync(migrationPath, 'utf8')

function compactSql(sql: string) {
  return sql.toLowerCase().replace(/\s+/g, ' ')
}

test('legacy room scope migration audits remaining estimates with no active v2 scope rows', () => {
  const sql = compactSql(migrationSql)

  assert.match(sql, /with legacy_rooms as \( select r\.\* from public\.estimate_rooms r/)
  assert.match(sql, /'all_scope_candidates'::text as audit_key/)
  assert.match(sql, /'after'::text as audit_phase, 'all_scope_candidates'::text as audit_key/)

  assert.match(
    sql,
    /not exists \( select 1 from public\.estimate_room_wall_scopes s where s\.org_id = r\.org_id and s\.estimate_id = r\.estimate_id and s\.active = 'y' \)/
  )
  assert.match(
    sql,
    /not exists \( select 1 from public\.estimate_segments s where s\.org_id = r\.org_id and s\.estimate_id = r\.estimate_id and s\.active = 'y' and s\.wall_scope_id is not null \)/
  )
  assert.match(
    sql,
    /not exists \( select 1 from public\.estimate_room_ceiling_scopes s where s\.org_id = r\.org_id and s\.estimate_id = r\.estimate_id and s\.active = 'y' \)/
  )
  assert.match(
    sql,
    /not exists \( select 1 from public\.estimate_room_ceiling_scope_segments s where s\.org_id = r\.org_id and s\.estimate_id = r\.estimate_id and s\.active = 'y' \)/
  )
  assert.match(
    sql,
    /not exists \( select 1 from public\.estimate_room_trim_scopes s where s\.org_id = r\.org_id and s\.estimate_id = r\.estimate_id and s\.active = 'y' \)/
  )
  assert.match(
    sql,
    /not exists \( select 1 from public\.estimate_room_door_scopes s where s\.org_id = r\.org_id and s\.estimate_id = r\.estimate_id and s\.active = 'y' \)/
  )
  assert.match(
    sql,
    /not exists \( select 1 from public\.estimate_drywall_repairs s where s\.org_id = r\.org_id and s\.estimate_id = r\.estimate_id and s\.active = 'y' \)/
  )
})

test('legacy room scope migration documents manual zero-count verification', () => {
  const sql = compactSql(migrationSql)

  assert.match(sql, /final verification query/)
  assert.match(sql, /manual supabase verification/)
  assert.match(sql, /confirm all_scope_candidates returns/)
  assert.match(sql, /estimate_count = 0 and room_count = 0/)
})

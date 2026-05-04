import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/sql/078_create_estimate_version_setting_set.sql'
)
const migrationSql = readFileSync(migrationPath, 'utf8')

test('estimate version creation captures the active setting set on the estimate row', () => {
  assert.match(migrationSql, /create or replace function public\.create_estimate_version/i)
  assert.match(
    migrationSql,
    /select active_set\.id[\s\S]*into v_setting_set_id[\s\S]*from public\.estimator_setting_set active_set[\s\S]*active_set\.status = 'active'/i
  )
  assert.match(
    migrationSql,
    /insert into public\.estimates \([\s\S]*setting_set_id_used[\s\S]*\)[\s\S]*values \([\s\S]*v_setting_set_id/i
  )
})

test('estimate version creation seeds from setting set scalars with compatibility fallback', () => {
  assert.match(migrationSql, /insert into public\.estimate_jobsettings/i)
  assert.match(
    migrationSql,
    /from public\.estimator_setting_value values[\s\S]*values\.category_key = 'scalar_defaults'/i
  )
  assert.match(
    migrationSql,
    /coalesce\(nullif\(v_setting_values ->> 'walls_paint_id', ''\), v_template\.walls_paint_id\)/i
  )
  assert.match(
    migrationSql,
    /coalesce\(\(v_setting_values ->> 'override_labor_rate'\)::numeric, v_template\.override_labor_rate, 40\)/i
  )
  assert.match(migrationSql, /insert into public\.estimate_pricing_policies/i)
  assert.match(
    migrationSql,
    /'setting_set_id_used', v_estimate\.setting_set_id_used/i
  )
})

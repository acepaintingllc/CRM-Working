import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/sql/098_move_ceiling_production_rates_out_of_walls.sql'
)
const migrationSql = readFileSync(migrationPath, 'utf8')

test('ceiling production migration moves misclassified template rows to the ceiling category', () => {
  assert.match(migrationSql, /from public\.estimator_template_constant_rows r/i)
  assert.match(migrationSql, /category_key = 'production_rates_walls'/i)
  assert.match(migrationSql, /category_key = 'production_rates_ceilings'/i)
  assert.match(migrationSql, /upper\(coalesce\(r\.row_id, ''\)\) like 'CEIL%'/i)
  assert.match(migrationSql, /jsonb_set\([\s\S]*'\{production_scope\}'[\s\S]*'"ceilings"'/i)
})

test('ceiling production migration corrects setting-set rows used by Rates and Flags', () => {
  assert.match(migrationSql, /from public\.estimator_setting_value v/i)
  assert.match(migrationSql, /v\.category_key = 'production_rates_walls'/i)
  assert.match(migrationSql, /target\.category_key = 'production_rates_ceilings'/i)
  assert.match(migrationSql, /target\.setting_set_id = source\.setting_set_id/i)
  assert.match(migrationSql, /delete from public\.estimator_setting_value wrong/i)
})

test('ceiling production migration handles existing target rows before deleting duplicates', () => {
  const settingValuesIndex = migrationSql.indexOf(
    'create temporary table if not exists _ceiling_setting_production_values'
  )
  const settingSql = migrationSql.slice(settingValuesIndex)
  const targetUpdateIndex = settingSql.indexOf(
    "where target.setting_set_id = source.setting_set_id\n      and target.category_key = 'production_rates_ceilings'"
  )
  const sourceUpdateIndex = settingSql.indexOf(
    'where target.id = source.id'
  )
  const deleteIndex = settingSql.search(/delete from public\.estimator_setting_value wrong/i)

  assert.ok(settingValuesIndex >= 0, 'Expected setting-set correction block.')
  assert.ok(targetUpdateIndex >= 0, 'Expected update of existing ceiling target rows.')
  assert.ok(sourceUpdateIndex >= 0, 'Expected move of non-conflicting source rows.')
  assert.ok(deleteIndex >= 0, 'Expected cleanup of duplicate wall-category rows.')
  assert.ok(targetUpdateIndex < sourceUpdateIndex, 'Expected conflict target update before moving source rows.')
  assert.ok(sourceUpdateIndex < deleteIndex, 'Expected duplicate cleanup after source row move.')
})

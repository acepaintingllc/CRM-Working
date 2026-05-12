import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/sql/094_job_color_selection_statuses.sql'
)
const migrationSql = readFileSync(migrationPath, 'utf8')

test('job color selection status migration supports customer revision workflow', () => {
  assert.match(migrationSql, /alter table public\.job_color_selection_sets/i)
  assert.match(migrationSql, /alter table public\.job_color_selections/i)
  assert.match(migrationSql, /'draft'/i)
  assert.match(migrationSql, /'submitted'/i)
  assert.match(migrationSql, /'confirmed'/i)
  assert.match(migrationSql, /'needs_revision'/i)
})

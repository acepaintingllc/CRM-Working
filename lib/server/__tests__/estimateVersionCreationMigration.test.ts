import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/sql/059_atomic_estimate_version_creation.sql'
)
const migrationSql = readFileSync(migrationPath, 'utf8')

test('atomic estimate version migration enforces unique ordering per job', () => {
  assert.match(
    migrationSql,
    /create unique index if not exists estimates_job_version_sort_unique_idx/i
  )
  assert.match(migrationSql, /on public\.estimates \(org_id, job_id, version_sort_order\)/i)
})

test('atomic estimate version migration retries transactional creation on ordering collisions', () => {
  assert.match(migrationSql, /create or replace function public\.create_estimate_version/i)
  assert.match(migrationSql, /while v_attempt < v_max_attempts loop/i)
  assert.match(
    migrationSql,
    /coalesce\(max\(e\.version_sort_order\), -1\) \+ 1/i
  )
  assert.match(migrationSql, /when unique_violation then/i)
  assert.match(
    migrationSql,
    /Another version was created at the same time\. Please retry\./i
  )
})

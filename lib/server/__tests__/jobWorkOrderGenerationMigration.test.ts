import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/sql/095_job_work_order_generation.sql'
)
const migrationSql = readFileSync(migrationPath, 'utf8')

test('job work order generation migration adds stable document storage', () => {
  assert.match(migrationSql, /alter table public\.job_work_orders/i)
  assert.match(migrationSql, /add column if not exists document_json jsonb not null default '\{\}'::jsonb/i)
  assert.match(migrationSql, /add column if not exists generated_at timestamptz null/i)
  assert.match(migrationSql, /add column if not exists locked_at timestamptz null/i)
})

test('job work order generation migration normalizes lifecycle status names', () => {
  assert.match(migrationSql, /when status = 'issued' then 'locked'/i)
  assert.match(migrationSql, /when status in \('superseded', 'voided'\) then 'void'/i)
  assert.match(migrationSql, /drop constraint if exists job_work_orders_status_check/i)
  assert.match(migrationSql, /check \(status in \('draft', 'generated', 'locked', 'void'\)\)/i)
})

test('job work order generation migration keeps legacy generated snapshot compatible', () => {
  assert.match(migrationSql, /document_json = case/i)
  assert.match(migrationSql, /then generated_snapshot_json/i)
  assert.match(migrationSql, /comment on column public\.job_work_orders\.generated_snapshot_json/i)
})

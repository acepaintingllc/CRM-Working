import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const migrationPath = path.resolve(process.cwd(), 'supabase/sql/083_trend_recommendations.sql')
const migrationSql = readFileSync(migrationPath, 'utf8')

test('trend recommendations migration creates recommendation records', () => {
  assert.match(migrationSql, /create table if not exists public\.trend_recommendation/i)
  assert.match(migrationSql, /status text not null default 'open'/i)
  assert.match(migrationSql, /applied_setting_set_id uuid null references public\.estimator_setting_set/i)
  assert.match(migrationSql, /trend_recommendation_open_target_evidence_idx/i)
})

test('trend recommendations migration applies one recommendation transactionally', () => {
  assert.match(
    migrationSql,
    /create or replace function public\.apply_trend_recommendation/i
  )
  assert.match(migrationSql, /from public\.trend_recommendation[\s\S]*for update/i)
  assert.match(migrationSql, /from public\.estimator_setting_set[\s\S]*status = 'active'[\s\S]*for update/i)
  assert.match(migrationSql, /insert into public\.estimator_setting_set/i)
  assert.match(migrationSql, /insert into public\.estimator_setting_value/i)
  assert.match(migrationSql, /perform public\.activate_estimator_setting_set/i)
  assert.match(migrationSql, /insert into public\.setting_change_log/i)
  assert.match(migrationSql, /recommendation_id/i)
  assert.match(migrationSql, /status = 'applied'/i)
})

test('trend recommendation apply RPC marks stale values without activating a draft', () => {
  assert.match(migrationSql, /status = 'stale'/i)
  assert.match(migrationSql, /applied_setting_set_id = null/i)
  assert.match(migrationSql, /return to_jsonb\(v_recommendation\)/i)
})

test('trend recommendation apply RPC grants service-role execution only', () => {
  assert.match(
    migrationSql,
    /revoke all on function public\.apply_trend_recommendation\(uuid, uuid, uuid\) from authenticated/i
  )
  assert.match(
    migrationSql,
    /grant execute on function public\.apply_trend_recommendation\(uuid, uuid, uuid\) to service_role/i
  )
})

test('trend recommendation RLS prevents authenticated direct applied writes', () => {
  assert.match(
    migrationSql,
    /create policy trend_recommendation_insert[\s\S]*with check \(\s*trend_recommendation\.status <> 'applied'/i
  )
  assert.match(
    migrationSql,
    /create policy trend_recommendation_update[\s\S]*with check \(\s*trend_recommendation\.status <> 'applied'/i
  )
})

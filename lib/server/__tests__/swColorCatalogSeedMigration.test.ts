import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const migrationSql = readFileSync(
  path.resolve(process.cwd(), 'supabase/sql/093_sw_color_catalog_seed.sql'),
  'utf8'
)
const importScript = readFileSync(
  path.resolve(process.cwd(), 'scripts/import-sw-colors.mjs'),
  'utf8'
)
const packageJson = JSON.parse(
  readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')
) as { scripts?: Record<string, string> }

test('SW color catalog seed adds searchable import fields', () => {
  for (const column of [
    'external_code text null',
    'name text null',
    'family text null',
    'hex text null',
    'lrv numeric null',
    'collection text null',
    'active boolean not null default true',
    "metadata_json jsonb not null default '{}'::jsonb",
  ]) {
    assert.match(migrationSql, new RegExp(column.replace(/[()]/g, '\\$&'), 'i'))
  }

  assert.match(migrationSql, /paint_color_catalog_lrv_range_check/i)
  assert.match(migrationSql, /paint_color_catalog_hex_check/i)
  assert.match(migrationSql, /paint_color_catalog_org_brand_external_code_uniq/i)
  assert.match(migrationSql, /paint_color_catalog_org_search_idx/i)
})

test('SW color catalog seed creates Sherwin-Williams starter rows and manual fallback', () => {
  assert.match(migrationSql, /'sherwin-williams'/i)
  assert.match(migrationSql, /'Sherwin-Williams'/i)
  assert.match(migrationSql, /'SW 7008', 'Alabaster'/i)
  assert.match(migrationSql, /'SW 7015', 'Repose Gray'/i)
  assert.match(migrationSql, /'SW 6258', 'Tricorn Black'/i)
  assert.match(migrationSql, /'manual-custom'/i)
  assert.match(migrationSql, /'CUSTOM'/i)
  assert.match(migrationSql, /'manual_fallback', true/i)
  assert.match(migrationSql, /status = 'archived' then false/i)
})

test('SW color catalog import script supports authorized CSV or JSON imports', () => {
  assert.equal(packageJson.scripts?.['seed:sw-colors'], 'node scripts/import-sw-colors.mjs')
  assert.match(importScript, /--file=\.\/sw-colors\.csv/i)
  assert.match(importScript, /--file=\.\/sw-colors\.json/i)
  assert.match(importScript, /Expected CSV headers:/i)
  assert.match(importScript, /external_code,name,family,hex,lrv,collection,active/i)
  assert.match(importScript, /The script does not scrape vendor websites/i)
  assert.match(importScript, /onConflict: 'org_id,brand_id,external_code'/i)
  assert.match(importScript, /normalizeActive/i)
  assert.match(importScript, /discontinued/i)
})

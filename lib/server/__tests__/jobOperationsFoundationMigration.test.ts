import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/sql/092_job_operations_foundation.sql'
)
const migrationSql = readFileSync(migrationPath, 'utf8')

const requiredTables = [
  'paint_brands',
  'paint_color_catalog',
  'paint_sheens',
  'paint_product_sheen_options',
  'job_color_selection_sets',
  'job_color_selections',
  'job_work_orders',
  'job_invoices',
  'job_change_orders',
  'job_operations_events',
]

function tableBlock(table: string) {
  const match = migrationSql.match(
    new RegExp(`create table if not exists public\\.${table} \\([\\s\\S]*?\\n\\);`, 'i')
  )
  assert.ok(match, `missing table block for ${table}`)
  return match[0]
}

test('job operations foundation migration creates all phase 2 tables with org scope', () => {
  for (const table of requiredTables) {
    assert.match(migrationSql, new RegExp(`create table if not exists public\\.${table}`, 'i'))
    assert.match(tableBlock(table), /org_id uuid not null references public\.orgs\(id\)/i)
  }
})

test('job operations tables link operational records to jobs, estimates, and accepted snapshots', () => {
  for (const table of [
    'job_color_selection_sets',
    'job_color_selections',
    'job_work_orders',
    'job_invoices',
    'job_change_orders',
  ]) {
    const sql = tableBlock(table)
    assert.match(sql, /job_id uuid not null references public\.jobs\(id\)/i)
    assert.match(sql, /estimate_id uuid not null references public\.estimates\(id\)/i)
    assert.match(sql, /estimate_snapshot_id uuid not null references public\.estimate_snapshot\(id\)/i)
    assert.match(
      sql,
      /foreign key \(estimate_snapshot_id, org_id, job_id, estimate_id\)[\s\S]*references public\.estimate_snapshot \(id, org_id, job_id, estimate_id\)/i
    )
  }
})

test('document tables snapshot display names and totals for historical rendering', () => {
  for (const table of ['job_work_orders', 'job_invoices', 'job_change_orders']) {
    const sql = tableBlock(table)
    assert.match(sql, /accepted_estimate_display_name text null/i)
    assert.match(sql, /customer_display_name text null/i)
    assert.match(sql, /job_display_name text null/i)
    assert.match(sql, /generated_snapshot_json jsonb not null default '\{\}'::jsonb/i)
    assert.match(sql, /source_summary_json jsonb not null default '\{\}'::jsonb/i)
  }

  assert.match(tableBlock('job_work_orders'), /work_order_total numeric not null default 0/i)
  assert.match(tableBlock('job_invoices'), /accepted_quote_total numeric not null default 0/i)
  assert.match(tableBlock('job_invoices'), /accepted_change_order_total numeric not null default 0/i)
  assert.match(tableBlock('job_invoices'), /balance_due numeric not null default 0/i)
  assert.match(tableBlock('job_change_orders'), /delta_total numeric not null default 0/i)
})

test('invoice generation migration adds document and lifecycle fields', () => {
  const invoiceMigrationSql = readFileSync(
    path.resolve(process.cwd(), 'supabase/sql/096_job_invoice_generation.sql'),
    'utf8'
  )

  assert.match(invoiceMigrationSql, /add column if not exists document_json jsonb not null default '\{\}'::jsonb/i)
  assert.match(invoiceMigrationSql, /add column if not exists invoice_number/i)
  assert.match(invoiceMigrationSql, /add column if not exists payment_terms text null/i)
  assert.match(invoiceMigrationSql, /add column if not exists due_date date null/i)
  assert.match(invoiceMigrationSql, /add column if not exists sent_at timestamptz null/i)
  assert.match(invoiceMigrationSql, /add column if not exists paid_at/i)
  assert.match(invoiceMigrationSql, /add column if not exists voided_at/i)
  assert.match(invoiceMigrationSql, /add column if not exists deposit_total numeric not null default 0/i)
  assert.match(invoiceMigrationSql, /add column if not exists tax_rate numeric not null default 0/i)
  assert.match(invoiceMigrationSql, /add column if not exists tax_total numeric not null default 0/i)
  assert.match(invoiceMigrationSql, /check \(status in \('draft', 'sent', 'paid', 'void'\)\)/i)
})

test('customer-writable operational tables include token boundaries without anon table grants', () => {
  assert.match(tableBlock('job_color_selection_sets'), /public_token_hash text null/i)
  assert.match(tableBlock('job_color_selection_sets'), /public_token_expires_at timestamptz null/i)
  assert.match(tableBlock('job_color_selection_sets'), /job_color_selection_sets_token_boundary_check/i)
  assert.match(tableBlock('job_change_orders'), /public_token_hash text null/i)
  assert.match(tableBlock('job_change_orders'), /public_token_expires_at timestamptz null/i)
  assert.match(tableBlock('job_change_orders'), /job_change_orders_token_boundary_check/i)
  assert.match(migrationSql, /revoke all on table public\..* from anon/i)
  assert.doesNotMatch(migrationSql, /grant .* on table public\..* to anon/i)
})

test('job operations foundation applies RLS and org-member policies to every table', () => {
  for (const table of requiredTables) {
    assert.match(
      migrationSql,
      new RegExp(`alter table public\\.${table} enable row level security`, 'i')
    )
    assert.match(migrationSql, new RegExp(`'${table}'`, 'i'))
  }

  assert.match(migrationSql, /t \|\| '_select'/i)
  assert.match(migrationSql, /t \|\| '_insert'/i)
  assert.match(migrationSql, /t \|\| '_update'/i)
  assert.match(migrationSql, /create policy %I on public\.%I for select to authenticated/i)
  assert.match(migrationSql, /create policy %I on public\.%I for insert to authenticated/i)
  assert.match(migrationSql, /create policy %I on public\.%I for update to authenticated/i)
  assert.match(migrationSql, /from public\.org_members m/i)
  assert.match(migrationSql, /m\.user_id = auth\.uid\(\)/i)
  assert.match(migrationSql, /m\.org_id = %I\.org_id/i)
})

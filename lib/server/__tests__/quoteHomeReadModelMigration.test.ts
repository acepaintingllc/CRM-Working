import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const quoteHomeMigrationFiles = [
  'supabase/sql/060_quote_home_read_model.sql',
  'supabase/sql/061_fix_quote_home_and_customer_uniqueness_hardening.sql',
  'supabase/sql/062_fix_quote_home_jobs_page_status_type.sql',
]

function readMigration(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

test('quote home jobs RPC casts enum job status to the text read-model contract', () => {
  for (const relativePath of quoteHomeMigrationFiles) {
    const migrationSql = readMigration(relativePath)

    assert.match(
      migrationSql,
      /create or replace function public\.quote_home_jobs_page/i,
      `${relativePath} should define quote_home_jobs_page`
    )
    assert.match(
      migrationSql,
      /status text,/i,
      `${relativePath} should keep the RPC result contract as text`
    )
    assert.match(
      migrationSql,
      /j\.status::text as status/i,
      `${relativePath} should cast public.job_status before returning rows`
    )
    assert.match(
      migrationSql,
      /c\.name::text as customer_name/i,
      `${relativePath} should cast customer display fields before returning rows`
    )
    assert.match(
      migrationSql,
      /j\.title::text as title/i,
      `${relativePath} should cast job display fields before returning rows`
    )
  }
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {
  jobReviewDataQualityStatuses,
  jobReviewPrimaryCauseTags,
} from '../../../types/jobs/feedback.ts'

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/sql/084_job_review_contract_constraints.sql'
)
const migrationSql = readFileSync(migrationPath, 'utf8')

function extractInValues(sql: string, columnName: string) {
  const pattern = new RegExp(`${columnName}\\s+in\\s+\\(([^)]*)\\)`, 'i')
  const match = sql.match(pattern)
  assert(match, `Expected ${columnName} check constraint values.`)
  return [...match[1].matchAll(/'([^']+)'/g)].map((valueMatch) => valueMatch[1])
}

test('job review contract migration constrains primary cause tags to the canonical taxonomy or null', () => {
  assert.match(migrationSql, /constraint job_review_primary_cause_tag_check/i)
  assert.match(migrationSql, /primary_cause_tag is null/i)
  assert.deepEqual(
    extractInValues(migrationSql, 'primary_cause_tag'),
    jobReviewPrimaryCauseTags
  )
})

test('job review contract migration keeps status and data quality checks aligned with shared contracts', () => {
  assert.match(migrationSql, /constraint job_review_status_contract_check/i)
  assert.deepEqual(extractInValues(migrationSql, 'status'), ['draft', 'reviewed', 'locked'])

  assert.match(migrationSql, /constraint job_review_data_quality_status_contract_check/i)
  assert.deepEqual(
    extractInValues(migrationSql, 'data_quality_status'),
    jobReviewDataQualityStatuses
  )
})

test('job review contract migration is additive and validates only named check constraints', () => {
  assert.match(migrationSql, /add constraint job_review_primary_cause_tag_check/i)
  assert.match(migrationSql, /not valid/i)
  assert.match(migrationSql, /validate constraint job_review_primary_cause_tag_check/i)
  assert.doesNotMatch(migrationSql, /\bdrop\s+table\b/i)
  assert.doesNotMatch(migrationSql, /\bdrop\s+column\b/i)
  assert.doesNotMatch(migrationSql, /\bdelete\s+from\b/i)
  assert.doesNotMatch(migrationSql, /\btruncate\b/i)
})

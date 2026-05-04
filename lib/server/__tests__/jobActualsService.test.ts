import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  lockJobActuals,
  normalizeActualsSnapshotId,
  normalizeJobActualsDraftInput,
  saveDraftJobActuals,
  submitJobActuals,
  type JobActualsRow,
} from '../estimate-feedback/actuals.ts'

const orgId = '11111111-1111-4111-8111-111111111111'
const otherOrgId = '22222222-2222-4222-8222-222222222222'
const jobId = '33333333-3333-4333-8333-333333333333'
const otherJobId = '44444444-4444-4444-8444-444444444444'
const snapshotId = '55555555-5555-4555-8555-555555555555'
const userId = '66666666-6666-4666-8666-666666666666'

type DbError = { code?: string | null; message?: string | null }
type TableName = 'estimate_snapshot' | 'job_actuals'

function createActualsDb(options: {
  snapshots?: Array<Record<string, unknown>>
  actuals?: JobActualsRow[]
  insertError?: DbError | null
} = {}) {
  const snapshots = options.snapshots ?? [{ id: snapshotId, org_id: orgId, job_id: jobId }]
  const actuals = options.actuals ?? []

  class Builder {
    private filters: Array<[string, unknown]> = []
    private insertPayload: Record<string, unknown> | null = null
    private updatePayload: Record<string, unknown> | null = null
    private table: TableName

    constructor(table: TableName) {
      this.table = table
    }

    select() {
      return this
    }

    eq(column: string, value: unknown) {
      this.filters.push([column, value])
      return this
    }

    insert(payload: Record<string, unknown>) {
      this.insertPayload = payload
      return this
    }

    update(payload: Record<string, unknown>) {
      this.updatePayload = payload
      return this
    }

    async maybeSingle<T = unknown>() {
      return { data: (this.rows()[0] ?? null) as T | null, error: null }
    }

    async single<T = unknown>() {
      if (this.insertPayload) return this.performInsert<T>()
      if (this.updatePayload) return this.performUpdate<T>()
      return { data: (this.rows()[0] ?? null) as T | null, error: null }
    }

    private rows() {
      const source = this.table === 'estimate_snapshot' ? snapshots : actuals
      return source.filter((row) =>
        this.filters.every(([column, value]) => row[column as keyof typeof row] === value)
      )
    }

    private async performInsert<T>() {
      if (options.insertError) return { data: null as T | null, error: options.insertError }
      const duplicate = actuals.some(
        (row) =>
          row.org_id === this.insertPayload?.org_id &&
          row.job_id === this.insertPayload?.job_id &&
          row.estimate_snapshot_id === this.insertPayload?.estimate_snapshot_id
      )
      if (duplicate) {
        return {
          data: null as T | null,
          error: { code: '23505', message: 'duplicate key value violates unique constraint' },
        }
      }
      const now = '2026-05-03T12:00:00.000Z'
      const row = {
        id: `actual-${actuals.length + 1}`,
        submitted_at: null,
        locked_at: null,
        created_at: now,
        updated_at: now,
        created_by: null,
        ...this.insertPayload,
      } as JobActualsRow
      actuals.push(row)
      return { data: row as T, error: null }
    }

    private async performUpdate<T>() {
      const row = this.rows()[0] as JobActualsRow | undefined
      if (!row) return { data: null as T | null, error: { message: 'No rows updated' } }
      if (row.status === 'locked') {
        return { data: null as T | null, error: { message: 'locked job actuals are immutable' } }
      }
      Object.assign(row, this.updatePayload, { updated_at: '2026-05-03T12:01:00.000Z' })
      return { data: row as T, error: null }
    }
  }

  return {
    db: {
      from(table: TableName) {
        return new Builder(table)
      },
    },
    actuals,
    snapshots,
  }
}

function draft(overrides: Partial<Parameters<typeof saveDraftJobActuals>[0]['input']> = {}) {
  return {
    estimate_snapshot_id: snapshotId,
    actual_labor_hours: 12,
    actual_paint_gallons: 4,
    actual_supplies_cost: 80,
    actual_other_cost: 25,
    notes: 'Closeout notes',
    ...overrides,
  }
}

describe('job actuals service', () => {
  it('rejects invalid UUID input before persistence', () => {
    assert.deepEqual(normalizeActualsSnapshotId('not-a-uuid'), {
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid estimate snapshot id.',
    })
    assert.deepEqual(
      normalizeJobActualsDraftInput(draft({ estimate_snapshot_id: 'not-a-uuid' })),
      {
        ok: false,
        kind: 'invalid_input',
        message: 'Invalid estimate snapshot id.',
      }
    )
  })

  it('saves draft actuals repeatedly without creating duplicates', async () => {
    const { db, actuals } = createActualsDb()

    const first = await saveDraftJobActuals(
      { orgId, jobId, userId, input: draft() },
      { db: db as never }
    )
    assert.equal(first.ok, true)

    const second = await saveDraftJobActuals(
      { orgId, jobId, userId, input: draft({ actual_labor_hours: 14, notes: 'Updated' }) },
      { db: db as never }
    )

    assert.equal(second.ok, true)
    assert.equal(actuals.length, 1)
    assert.equal(actuals[0].actual_labor_hours, 14)
    assert.equal(actuals[0].notes, 'Updated')
  })

  it('rejects snapshots from a different org or job', async () => {
    const { db, actuals } = createActualsDb({
      snapshots: [{ id: snapshotId, org_id: otherOrgId, job_id: otherJobId }],
    })

    const result = await saveDraftJobActuals(
      { orgId, jobId, userId, input: draft() },
      { db: db as never }
    )

    assert.deepEqual(result, {
      ok: false,
      kind: 'not_found',
      message: 'Estimate snapshot not found for this job.',
    })
    assert.equal(actuals.length, 0)
  })

  it('submits draft actuals and locks submitted actuals', async () => {
    const { db, actuals } = createActualsDb()
    await saveDraftJobActuals({ orgId, jobId, userId, input: draft() }, { db: db as never })

    const submitted = await submitJobActuals(
      { orgId, jobId, userId, estimateSnapshotId: snapshotId },
      { db: db as never, now: () => new Date('2026-05-03T13:00:00.000Z') }
    )
    assert.equal(submitted.ok, true)
    assert.equal(actuals[0].status, 'submitted')
    assert.equal(actuals[0].submitted_at, '2026-05-03T13:00:00.000Z')

    const locked = await lockJobActuals(
      { orgId, jobId, userId, estimateSnapshotId: snapshotId },
      { db: db as never, now: () => new Date('2026-05-03T14:00:00.000Z') }
    )
    assert.equal(locked.ok, true)
    assert.equal(actuals[0].status, 'locked')
    assert.equal(actuals[0].locked_at, '2026-05-03T14:00:00.000Z')
  })

  it('blocks draft saves after actuals are submitted or locked', async () => {
    const { db } = createActualsDb()
    await saveDraftJobActuals({ orgId, jobId, userId, input: draft() }, { db: db as never })
    await submitJobActuals({ orgId, jobId, userId, estimateSnapshotId: snapshotId }, { db: db as never })

    const submittedSave = await saveDraftJobActuals(
      { orgId, jobId, userId, input: draft({ actual_labor_hours: 20 }) },
      { db: db as never }
    )
    assert.deepEqual(submittedSave, {
      ok: false,
      kind: 'conflict',
      message: 'Submitted or locked job actuals cannot be overwritten through draft save.',
    })

    await lockJobActuals({ orgId, jobId, userId, estimateSnapshotId: snapshotId }, { db: db as never })
    const lockedSave = await saveDraftJobActuals(
      { orgId, jobId, userId, input: draft({ actual_labor_hours: 30 }) },
      { db: db as never }
    )
    assert.deepEqual(lockedSave, submittedSave)
  })

  it('maps insert unique conflicts to duplicate prevention errors', async () => {
    const { db } = createActualsDb({
      insertError: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })

    const result = await saveDraftJobActuals(
      { orgId, jobId, userId, input: draft() },
      { db: db as never }
    )

    assert.deepEqual(result, {
      ok: false,
      kind: 'conflict',
      message: 'Job actuals already exist for this estimate snapshot.',
    })
  })
})

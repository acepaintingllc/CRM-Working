import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildEstimateSnapshotRows,
  insertEstimateSnapshotIfMissing,
} from '../estimate-feedback/snapshots.ts'
import type { EstimateV2GetResponse } from '../../../types/estimator/v2.ts'

function estimateResponse(overrides: Partial<EstimateV2GetResponse> = {}) {
  return {
    estimate: {
      id: 'estimate-1',
      job_id: 'job-1',
      customer_id: 'customer-1',
      version_name: 'Interior repaint',
      version_state: 'live',
      version_kind: 'base',
      setting_set_id_used: 'setting-set-old',
    },
    inputs: {
      jobsettings: { override_labor_rate: 80 },
      org_defaults: { override_labor_rate: 75 },
      paint_products: [],
      rooms: [{ id: 'room-row-1', room_id: 'R001', room_name: 'Kitchen' }],
      room_wall_scopes: [],
      segments: [],
      wall_segments: [],
      ceiling_segments: [],
      room_ceiling_scopes: [],
      ceiling_scope_segments: [],
      room_trim_scopes: [],
      room_door_scopes: [],
      drywall_repairs: [],
      rollers: [],
      prejob: [],
      trim_items: [],
      job_colors: [],
      room_flags: [],
      access_fees: [
        {
          id: 'access-1',
          room_id: 'R001',
          label: 'Tall ladder',
          effective_total: 125,
        },
      ],
      other: [
        {
          id: 'other-1',
          room_id: 'R001',
          description: 'Fixture removal',
          effective_paint_hours: 1,
          effective_total: 200,
        },
      ],
    },
    wall_calculations: {
      scopes: [
        {
          id: 'wall-1',
          room_id: 'R001',
          scope_name: 'Kitchen walls',
          effective_paint_hours: 5,
          effective_primer_hours: 1,
          effective_paint_gallons: 2,
          effective_primer_gallons: 0.5,
          allocated_paint_material_cost: 90,
          primer_price_per_gal: 20,
          effective_supply_cost: 35,
          effective_total: 600,
        },
      ],
    },
    ceiling_calculations: { scopes: [] },
    trim_calculations: { scopes: [] },
    door_calculations: { scopes: [] },
    drywall_calculations: { scopes: [] },
    trim_paint: null,
    pricing_summary: {
      effectiveLaborHours: 16,
      paintMaterialCost: 90,
      primerMaterialCost: 10,
      supplyCost: 35,
      sharedAccessCost: 125,
      finalTotal: 1_250,
    },
    ...overrides,
  } as unknown as EstimateV2GetResponse
}

function buildRows(response = estimateResponse()) {
  return buildEstimateSnapshotRows({
    orgId: 'org-1',
    estimateResponse: response,
    job: { id: 'job-1', customer_id: 'customer-1', linked_estimate_id: 'estimate-1' },
    publicVersion: {
      id: 'public-version-1',
      version_number: 2,
      status: 'accepted',
      snapshot_json: { document: { total: 1_250, title: 'Accepted Quote' } },
    },
    createdBy: 'user-1',
  })
}

function createFn<TArgs extends unknown[], TResult>(
  impl: (...args: TArgs) => TResult
) {
  const calls: TArgs[] = []
  const fn = (...args: TArgs) => {
    calls.push(args)
    return impl(...args)
  }
  fn.calls = calls
  return fn
}

function createSnapshotDb(options: {
  existing?: Record<string, unknown> | null
  duplicateOnInsert?: boolean
  rpcError?: string | null
}) {
  const rpcPayloads: unknown[] = []
  let lookupCount = 0
  const db = {
    rpc(name: string, payload: unknown) {
      assert.equal(name, 'insert_estimate_snapshot_with_lines')
      rpcPayloads.push(JSON.parse(JSON.stringify(payload)))
      if (options.rpcError) {
        return Promise.resolve({
          data: null,
          error: { message: options.rpcError },
        })
      }
      if (options.duplicateOnInsert) {
        return Promise.resolve({
          data: null,
          error: {
            message:
              'duplicate key value violates unique constraint "estimate_snapshot_org_id_estimate_id_key"',
          },
        })
      }
      if (options.existing) {
        return Promise.resolve({
          data: options.existing,
          error: null,
        })
      }
      return Promise.resolve({
        data: {
          ...((payload as { p_snapshot: Record<string, unknown> }).p_snapshot),
          id: 'snapshot-1',
        },
        error: null,
      })
    },
    from(table: string) {
      if (table === 'estimate_snapshot') {
        return {
          select: createFn(() => ({
            eq: createFn(() => ({
              eq: createFn(() => ({
                maybeSingle: createFn(async () => {
                  lookupCount += 1
                  return {
                    data:
                      lookupCount >= 1 && options.duplicateOnInsert
                        ? { id: 'snapshot-raced', estimate_id: 'estimate-1' }
                        : options.existing ?? null,
                    error: null,
                  }
                }),
              })),
            })),
          })),
        }
      }

      throw new Error(`Unexpected table ${table}`)
    },
  }

  return { db, rpcPayloads }
}

describe('estimate operational snapshots', () => {
  it('builds accepted snapshot totals from canonical Estimator V2 calculated output', () => {
    const built = buildRows()

    assert.deepEqual(
      {
        org_id: built.snapshot.org_id,
        job_id: built.snapshot.job_id,
        estimate_id: built.snapshot.estimate_id,
        customer_id: built.snapshot.customer_id,
        accepted_public_version_id: built.snapshot.accepted_public_version_id,
        setting_set_id_used: built.snapshot.setting_set_id_used,
        snapshot_created_reason: built.snapshot.snapshot_created_reason,
        estimated_labor_hours: built.snapshot.estimated_labor_hours,
        estimated_paint_gallons: built.snapshot.estimated_paint_gallons,
        estimated_primer_gallons: built.snapshot.estimated_primer_gallons,
        estimated_paint_material_cost: built.snapshot.estimated_paint_material_cost,
        estimated_supplies_cost: built.snapshot.estimated_supplies_cost,
        estimated_other_cost: built.snapshot.estimated_other_cost,
        estimated_access_cost: built.snapshot.estimated_access_cost,
        estimated_total: built.snapshot.estimated_total,
      },
      {
        org_id: 'org-1',
        job_id: 'job-1',
        estimate_id: 'estimate-1',
        customer_id: 'customer-1',
        accepted_public_version_id: 'public-version-1',
        setting_set_id_used: 'setting-set-old',
        snapshot_created_reason: 'accepted',
        estimated_labor_hours: 16,
        estimated_paint_gallons: 2,
        estimated_primer_gallons: 0.5,
        estimated_paint_material_cost: 100,
        estimated_supplies_cost: 35,
        estimated_other_cost: 200,
        estimated_access_cost: 125,
        estimated_total: 1_250,
      }
    )
    assert.deepEqual(built.snapshot.source_payload_json.customer_send_snapshot_json, {
      document: { total: 1_250, title: 'Accepted Quote' },
    })
    assert.deepEqual(
      built.lines.map((line) => line.line_key),
      ['walls:wall-1', 'other:other-1', 'access:access-1', 'summary:job-total']
    )
  })

  it('returns an existing snapshot through the atomic RPC without mutating immutable rows', async () => {
    const { db, rpcPayloads } = createSnapshotDb({
      existing: { id: 'snapshot-existing', estimate_id: 'estimate-1' },
    })

    const result = await insertEstimateSnapshotIfMissing(db as never, buildRows())

    assert.deepEqual(result, {
      ok: true,
      data: { id: 'snapshot-existing', estimate_id: 'estimate-1' },
    })
    assert.equal(rpcPayloads.length, 1)
  })

  it('creates exactly one snapshot and snapshot lines on first acceptance', async () => {
    const { db, rpcPayloads } = createSnapshotDb({ existing: null })

    const result = await insertEstimateSnapshotIfMissing(db as never, buildRows())

    assert.equal(result.ok, true)
    assert.equal(rpcPayloads.length, 1)
    const payload = rpcPayloads[0] as {
      p_snapshot: Record<string, unknown>
      p_lines: Array<Record<string, unknown>>
    }
    assert.equal(payload.p_snapshot.estimate_id, 'estimate-1')
    assert.ok(
      payload.p_lines.some(
        (line) =>
          line.line_key === 'summary:job-total' &&
          line.estimated_total === 1_250
      )
    )
  })

  it('reuses a duplicate snapshot created by a concurrent acceptance retry', async () => {
    const { db, rpcPayloads } = createSnapshotDb({
      existing: null,
      duplicateOnInsert: true,
    })

    const result = await insertEstimateSnapshotIfMissing(db as never, buildRows())

    assert.deepEqual(result, {
      ok: true,
      data: { id: 'snapshot-raced', estimate_id: 'estimate-1' },
    })
    assert.equal(rpcPayloads.length, 1)
  })

  it('rejects incomplete existing snapshots instead of silently using them', async () => {
    const { db } = createSnapshotDb({
      existing: null,
      rpcError: 'existing estimate snapshot is incomplete',
    })

    const result = await insertEstimateSnapshotIfMissing(db as never, buildRows())

    assert.deepEqual(result, {
      ok: false,
      kind: 'invalid_input',
      message: 'Existing estimate snapshot is incomplete and cannot be used for actuals.',
    })
  })

  it('keeps snapshot data unchanged after live estimate values mutate', () => {
    const response = estimateResponse()
    const built = buildRows(response)

    ;(response.pricing_summary as Record<string, unknown>).finalTotal = 9_999
    ;(response.wall_calculations?.scopes?.[0] as Record<string, unknown>).effective_total = 9_999

    assert.equal(built.snapshot.estimated_total, 1_250)
    assert.equal(
      built.lines.find((line) => line.line_key === 'walls:wall-1')?.estimated_total,
      600
    )
    assert.equal(
      (
        built.snapshot.totals_json.wall_calculations as {
          scopes: Array<{ effective_total: number }>
        }
      ).scopes[0].effective_total,
      600
    )
  })

  it('keeps the accepted estimate setting set after a new active setting set exists', () => {
    const response = estimateResponse()
    const built = buildRows(response)

    ;(response.estimate as Record<string, unknown>).setting_set_id_used =
      'setting-set-new-active'
    ;(response.inputs.org_defaults as Record<string, unknown>).override_labor_rate = 120

    assert.equal(built.snapshot.setting_set_id_used, 'setting-set-old')
    assert.deepEqual(built.snapshot.assumptions_json.org_defaults, {
      override_labor_rate: 75,
    })
  })
})

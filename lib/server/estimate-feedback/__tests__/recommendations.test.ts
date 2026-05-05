import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server/org', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

import {
  applyTrendRecommendation,
  generateTrendRecommendations,
  normalizeRecommendationPostInput,
  updateTrendRecommendationStatus,
  type TrendRecommendationRow,
} from '../recommendations'
import {
  buildRecommendationTargetKey,
  buildTrendRecommendationCandidates,
  parseRecommendationTargetKey,
  targetKeyForSettingValue,
} from '../recommendationRules'
import type { EstimateFeedbackTrendSummary } from '../../../../types/estimate-feedback/trends'
import type {
  EstimatorSettingSetRow,
  EstimatorSettingSetSnapshot,
  EstimatorSettingValueRow,
} from '../settingSets'

type GenerateDeps = NonNullable<Parameters<typeof generateTrendRecommendations>[2]>
type UpdateDeps = NonNullable<Parameters<typeof updateTrendRecommendationStatus>[2]>
type ApplyDeps = NonNullable<Parameters<typeof applyTrendRecommendation>[2]>

const orgId = '11111111-1111-4111-8111-111111111111'
const recommendationId = '22222222-2222-2222-2222-222222222222'
const settingSetId = '33333333-3333-4333-8333-333333333333'
const draftSettingSetId = '44444444-4444-4444-8444-444444444444'
const actorId = '55555555-5555-4555-8555-555555555555'

function trend(
  overrides: Partial<EstimateFeedbackTrendSummary> = {}
): EstimateFeedbackTrendSummary {
  return {
    filters: {
      from: null,
      to: null,
      jobType: null,
      occupancy: null,
      conditionTags: [],
      maxAbsoluteVariance: null,
      maxAbsoluteTotalImpact: null,
    },
    averageLaborVariance: 3,
    averagePaintVariance: 0.1,
    averageSuppliesVariance: 45,
    averageMissPerJob: 48.1,
    portfolioImpact: 481,
    jobsAnalyzed: 10,
    metrics: {
      labor: {
        averageVariance: 3,
        averageTotalImpact: 3,
        count: 10,
      },
      paint: {
        averageVariance: 0.1,
        averageTotalImpact: 0.1,
        count: 10,
      },
      supplies: {
        averageVariance: 45,
        averageTotalImpact: 45,
        count: 10,
      },
    },
    patterns: [],
    ...overrides,
  }
}

function settingSet(): EstimatorSettingSetSnapshot {
  const set: EstimatorSettingSetRow = {
    id: settingSetId,
    org_id: orgId,
    version_number: 1,
    status: 'active',
    source_set_id: null,
    created_by: null,
    activated_by: null,
    retired_by: null,
    activated_at: '2026-05-01T00:00:00.000Z',
    retired_at: null,
    notes: '',
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-01T00:00:00.000Z',
  }
  const values: EstimatorSettingValueRow[] = [
    {
      id: 'value-wall',
      org_id: orgId,
      setting_set_id: settingSetId,
      category_key: 'production_rates_walls',
      row_id: 'WALL_STD',
      scalar_key: null,
      display_name: 'Standard walls',
      active: true,
      sort_order: 0,
      value_json: { sqft_per_hr: '150' },
    },
    {
      id: 'value-supply',
      org_id: orgId,
      setting_set_id: settingSetId,
      category_key: 'supply_rates_area_based',
      row_id: 'AREA_STD',
      scalar_key: null,
      display_name: 'Area supplies',
      active: true,
      sort_order: 1,
      value_json: { cost_per: '0.2' },
    },
    {
      id: 'value-paint-default',
      org_id: orgId,
      setting_set_id: settingSetId,
      category_key: 'scalar_defaults',
      row_id: null,
      scalar_key: 'walls_paint_id',
      display_name: 'Walls Paint',
      active: true,
      sort_order: 2,
      value_json: { value: 'paint-wall' },
    },
  ]
  return { set, values }
}

function createRecommendationDb(initialRows: TrendRecommendationRow[] = []) {
  const rows = [...initialRows]
  let nextId = 1
  type RpcResponse = {
    data: TrendRecommendationRow | null
    error: { code?: string | null; message: string } | null
  }
  const rpc = vi.fn<() => Promise<RpcResponse>>(async () => ({
    data: null,
    error: { message: 'Unexpected recommendation RPC call.' },
  }))

  function createQuery() {
    const filters: Array<[string, unknown]> = []
    let inserted: Record<string, unknown> | null = null
    let updated: Record<string, unknown> | null = null

    function filteredRows() {
      return rows.filter((row) =>
        filters.every(([key, value]) => Reflect.get(row, key) === value)
      )
    }

    function createdRow() {
      if (!inserted) return null
      const row: TrendRecommendationRow = {
        id: `generated-${nextId++}`,
        org_id: String(inserted.org_id),
        target_setting_key: String(inserted.target_setting_key),
        current_value_json: inserted.current_value_json as Record<string, unknown>,
        suggested_value_json: inserted.suggested_value_json as Record<string, unknown>,
        reason: String(inserted.reason),
        evidence_json: inserted.evidence_json as Record<string, unknown>,
        evidence_hash: String(inserted.evidence_hash),
        confidence_label: inserted.confidence_label as TrendRecommendationRow['confidence_label'],
        based_on_job_count: Number(inserted.based_on_job_count),
        status: inserted.status as TrendRecommendationRow['status'],
        applied_setting_set_id: null,
        created_at: '2026-05-03T12:00:00.000Z',
        updated_at: '2026-05-03T12:00:00.000Z',
        applied_at: null,
        dismissed_at: null,
      }
      rows.push(row)
      return row
    }

    function applyUpdate() {
      if (!updated) return null
      const row = filteredRows()[0] ?? null
      if (!row) return null
      Object.assign(row, updated, { updated_at: '2026-05-03T12:05:00.000Z' })
      return row
    }

    function executeList() {
      if (inserted) {
        const row = createdRow()
        return { data: row ? [row] : [], error: null }
      }
      if (updated) {
        const row = applyUpdate()
        return { data: row ? [row] : [], error: null }
      }
      return { data: filteredRows(), error: null }
    }

    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((key: string, value: unknown) => {
        filters.push([key, value])
        return query
      }),
      order: vi.fn(() => query),
      insert: vi.fn((payload: Record<string, unknown>) => {
        inserted = payload
        return query
      }),
      update: vi.fn((payload: Record<string, unknown>) => {
        updated = payload
        return query
      }),
      maybeSingle: vi.fn(async () => {
        const result = executeList()
        return { data: result.data[0] ?? null, error: null }
      }),
      single: vi.fn(async () => {
        const result = executeList()
        return { data: result.data[0] ?? null, error: null }
      }),
      then: <TResult1 = { data: TrendRecommendationRow[]; error: null }, TResult2 = never>(
        resolve?: ((value: { data: TrendRecommendationRow[]; error: null }) => TResult1) | null,
        _reject?: ((reason: unknown) => TResult2) | null
      ) => {
        void _reject
        return Promise.resolve(executeList()).then(resolve ?? undefined)
      },
    }
    return query
  }

  return {
    db: { from: vi.fn(() => createQuery()), rpc },
    rows,
    rpc,
  }
}

function recommendationRow(
  overrides: Partial<TrendRecommendationRow> = {}
): TrendRecommendationRow {
  return {
    id: recommendationId,
    org_id: orgId,
    target_setting_key: 'production_rates_walls:WALL_STD:sqft_per_hr',
    current_value_json: { sqft_per_hr: 150 },
    suggested_value_json: { sqft_per_hr: 135 },
    reason: 'Adjust labor.',
    evidence_json: { rule_key: 'labor_production_rate_adjustment' },
    evidence_hash: 'hash-1',
    confidence_label: 'high',
    based_on_job_count: 10,
    status: 'open',
    applied_setting_set_id: null,
    created_at: '2026-05-03T12:00:00.000Z',
    updated_at: '2026-05-03T12:00:00.000Z',
    applied_at: null,
    dismissed_at: null,
    ...overrides,
  }
}

describe('trend recommendations', () => {
  it('builds labor recommendation candidates from trend and active setting inputs', () => {
    const candidates = buildTrendRecommendationCandidates({
      trend: trend({
        metrics: {
          labor: { averageVariance: 3, averageTotalImpact: 3, count: 10 },
          paint: { averageVariance: 1, averageTotalImpact: 1, count: 10 },
          supplies: { averageVariance: 0, averageTotalImpact: 0, count: 10 },
        },
      }),
      activeSettingSet: settingSet(),
    })

    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.target_setting_key).toBe(
      'production_rates_walls:WALL_STD:sqft_per_hr'
    )
    expect(candidates[0]?.suggested_value_json).toEqual({ sqft_per_hr: 135 })
    expect(candidates[0]?.evidence_json).toMatchObject({
      rule_key: 'labor_production_rate_adjustment',
      metric_key: 'labor',
      metric_count: 10,
    })
  })

  it('builds supplies recommendation candidates from trend and active setting inputs', () => {
    const candidates = buildTrendRecommendationCandidates({
      trend: trend({
        metrics: {
          labor: { averageVariance: 0, averageTotalImpact: 0, count: 10 },
          paint: { averageVariance: 1, averageTotalImpact: 1, count: 10 },
          supplies: { averageVariance: 45, averageTotalImpact: 45, count: 10 },
        },
      }),
      activeSettingSet: settingSet(),
    })

    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.target_setting_key).toBe(
      'supply_rates_area_based:AREA_STD:cost_per'
    )
    expect(candidates[0]?.suggested_value_json).toEqual({ cost_per: 0.22 })
    expect(candidates[0]?.evidence_json).toMatchObject({
      rule_key: 'supplies_baseline_adjustment',
      metric_key: 'supplies',
      metric_count: 10,
    })
  })

  it('builds labor and supplies candidates without no-op paint candidates', () => {
    const candidates = buildTrendRecommendationCandidates({
      trend: trend(),
      activeSettingSet: settingSet(),
    })

    expect(candidates).toHaveLength(2)
    expect(candidates.map((candidate) => candidate.target_setting_key)).toEqual([
      'production_rates_walls:WALL_STD:sqft_per_hr',
      'supply_rates_area_based:AREA_STD:cost_per',
    ])
    expect(candidates[1]?.suggested_value_json).toEqual({ cost_per: 0.22 })
  })

  it('does not return a stable paint no-change recommendation as an open candidate', () => {
    const candidates = buildTrendRecommendationCandidates({
      trend: trend({
        averageLaborVariance: 0,
        averageSuppliesVariance: 0,
        metrics: {
          labor: { averageVariance: 0, averageTotalImpact: 0, count: 10 },
          paint: { averageVariance: 0.1, averageTotalImpact: 0.1, count: 10 },
          supplies: { averageVariance: 0, averageTotalImpact: 0, count: 10 },
        },
      }),
      activeSettingSet: settingSet(),
    })

    expect(candidates).toEqual([])
  })

  it('filters candidates when current and suggested values are equal', () => {
    const snapshot = settingSet()
    snapshot.values[0] = {
      ...snapshot.values[0]!,
      value_json: { sqft_per_hr: 0 },
    }

    const candidates = buildTrendRecommendationCandidates({
      trend: trend({
        metrics: {
          labor: { averageVariance: 3, averageTotalImpact: 3, count: 10 },
          paint: { averageVariance: 1, averageTotalImpact: 1, count: 10 },
          supplies: { averageVariance: 0, averageTotalImpact: 0, count: 10 },
        },
      }),
      activeSettingSet: snapshot,
    })

    expect(candidates).toEqual([])
  })

  it('centralizes target key construction and parsing in the recommendation domain', () => {
    const snapshot = settingSet()
    const wallValue = snapshot.values[0]!
    const paintValue = snapshot.values[2]!

    expect(targetKeyForSettingValue(wallValue, 'sqft_per_hr')).toBe(
      'production_rates_walls:WALL_STD:sqft_per_hr'
    )
    expect(targetKeyForSettingValue(paintValue, 'value')).toBe(
      'scalar_defaults:walls_paint_id:value'
    )
    expect(
      buildRecommendationTargetKey({
        kind: 'row',
        categoryKey: 'production_rates_walls',
        rowId: 'WALL_STD',
        fieldKey: 'sqft_per_hr',
      })
    ).toBe('production_rates_walls:WALL_STD:sqft_per_hr')
    expect(
      buildRecommendationTargetKey({
        kind: 'scalar',
        scalarKey: 'walls_paint_id',
        fieldKey: 'value',
      })
    ).toBe('scalar_defaults:walls_paint_id:value')
    expect(parseRecommendationTargetKey('production_rates_walls:WALL_STD:sqft_per_hr')).toEqual({
      ok: true,
      data: {
        kind: 'row',
        categoryKey: 'production_rates_walls',
        rowId: 'WALL_STD',
        fieldKey: 'sqft_per_hr',
      },
    })
    expect(parseRecommendationTargetKey('scalar_defaults:walls_paint_id:value')).toEqual({
      ok: true,
      data: {
        kind: 'scalar',
        scalarKey: 'walls_paint_id',
        fieldKey: 'value',
      },
    })
    expect(parseRecommendationTargetKey('scalar_defaults:walls_paint_id:bad')).toMatchObject({
      ok: false,
    })
  })

  it('does not insert duplicate open recommendations for the same target evidence', async () => {
    const db = createRecommendationDb()
    const deps = {
      db: db.db as unknown as GenerateDeps['db'],
      loadTrends: vi.fn(async () => ({ ok: true as const, data: trend() })),
      loadActiveSettingSet: vi.fn(async () => settingSet()),
    }

    const input = { filters: trend().filters }
    const first = await generateTrendRecommendations(orgId, input, deps)
    const second = await generateTrendRecommendations(orgId, input, deps)

    expect(first.ok && first.data).toHaveLength(2)
    expect(second.ok && second.data).toHaveLength(2)
    expect(db.rows).toHaveLength(2)
  })

  it('updates dismiss and stale recommendation status timestamps without applying settings', async () => {
    const existing = recommendationRow()
    const db = createRecommendationDb([existing])
    const now = () => new Date('2026-05-03T13:00:00.000Z')

    const dismissed = await updateTrendRecommendationStatus(
      orgId,
      {
        recommendationId,
        status: 'dismissed',
        appliedSettingSetId: null,
      },
      { db: db.db as unknown as UpdateDeps['db'], now }
    )

    expect(dismissed.ok && dismissed.data.status).toBe('dismissed')
    expect(dismissed.ok && dismissed.data.dismissed_at).toBe('2026-05-03T13:00:00.000Z')

    const stale = await updateTrendRecommendationStatus(
      orgId,
      {
        recommendationId,
        status: 'stale',
        appliedSettingSetId: null,
      },
      { db: db.db as unknown as UpdateDeps['db'], now }
    )

    expect(stale.ok && stale.data.status).toBe('stale')
    expect(stale.ok && stale.data.dismissed_at).toBeNull()

    expect(stale.ok && stale.data.applied_setting_set_id).toBeNull()
    expect(stale.ok && stale.data.applied_at).toBeNull()
  })

  it('accepts database UUID shape recommendation ids in update_status input', () => {
    const input = normalizeRecommendationPostInput({
      action: 'update_status',
      recommendationId,
      status: 'dismissed',
    })

    expect(input).toEqual({
      ok: true,
      data: {
        action: 'update_status',
        recommendationId,
        status: 'dismissed',
        appliedSettingSetId: null,
      },
    })
  })

  it('rejects invalid recommendation ids in update_status input', () => {
    const input = normalizeRecommendationPostInput({
      action: 'update_status',
      recommendationId: 'not-a-uuid',
      status: 'dismissed',
    })

    expect(input).toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid recommendation id.',
    })
  })

  it('rejects applied status through the generic update_status input path', () => {
    const input = normalizeRecommendationPostInput({
      action: 'update_status',
      recommendationId,
      status: 'applied',
      appliedSettingSetId: settingSetId,
    })

    expect(input).toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Use the dedicated apply endpoint to apply recommendations.',
    })
  })

  it('applies an open recommendation through the atomic apply RPC', async () => {
    const db = createRecommendationDb([recommendationRow()])
    db.rpc.mockResolvedValueOnce({
      data: recommendationRow({
        status: 'applied',
        applied_setting_set_id: draftSettingSetId,
        applied_at: '2026-05-03T13:00:00.000Z',
      }),
      error: null,
    })

    const applied = await applyTrendRecommendation(
      orgId,
      { recommendationId, actorId },
      {
        db: db.db as unknown as ApplyDeps['db'],
      }
    )

    expect(applied.ok && applied.data.status).toBe('applied')
    expect(applied.ok && applied.data.applied_setting_set_id).toBe(draftSettingSetId)
    expect(db.rpc).toHaveBeenCalledWith('apply_trend_recommendation', {
      p_org_id: orgId,
      p_recommendation_id: recommendationId,
      p_actor_id: actorId,
    })
    expect(db.db.from).not.toHaveBeenCalled()
  })

  it('marks a recommendation stale and returns conflict when active value changed', async () => {
    const db = createRecommendationDb([recommendationRow()])
    db.rpc.mockImplementationOnce(async () => {
      Object.assign(db.rows[0]!, {
        status: 'stale',
        applied_setting_set_id: null,
        applied_at: null,
      })
      return { data: db.rows[0]!, error: null }
    })

    const applied = await applyTrendRecommendation(
      orgId,
      { recommendationId, actorId },
      {
        db: db.db as unknown as ApplyDeps['db'],
      }
    )

    expect(applied).toMatchObject({
      ok: false,
      kind: 'conflict',
    })
    expect(db.rows[0]?.status).toBe('stale')
    expect(db.rows[0]?.applied_setting_set_id).toBeNull()
  })

  it('returns server error when the atomic apply RPC rolls back', async () => {
    const db = createRecommendationDb([recommendationRow()])
    db.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'setting change log insert failed' },
    })

    const applied = await applyTrendRecommendation(
      orgId,
      { recommendationId, actorId },
      {
        db: db.db as unknown as ApplyDeps['db'],
      }
    )

    expect(applied).toEqual({
      ok: false,
      kind: 'server_error',
      message: 'setting change log insert failed',
    })
    expect(db.rows[0]?.status).toBe('open')
    expect(db.rows[0]?.applied_setting_set_id).toBeNull()
  })
})

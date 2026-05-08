import { describe, expect, it } from 'vitest'
import type {
  EstimateFeedbackTrendSummary,
} from '@/types/estimate-feedback/trends'
import type {
  TrendRecommendationRecord,
} from '@/types/estimate-feedback/recommendations'
import { buildInsightsTrendsPageVm } from '../insightsTrendsVm'

function buildSummary(
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
    averageLaborVariance: 2.5,
    averagePaintVariance: -1.25,
    averageSuppliesVariance: 42,
    averageMissPerJob: 185,
    portfolioImpact: 370,
    jobsAnalyzed: 2,
    metrics: {
      labor: { averageVariance: 2.5, averageTotalImpact: 240, count: 2 },
      paint: { averageVariance: -1.25, averageTotalImpact: -45, count: 2 },
      supplies: { averageVariance: 42, averageTotalImpact: 42, count: 1 },
    },
    patterns: [
      {
        key: 'labor',
        label: 'Labor variance',
        count: 2,
        averageVariance: 2.5,
        averageTotalImpact: 240,
        totalImpact: 480,
      },
    ],
    ...overrides,
  }
}

function buildRecommendation(
  overrides: Partial<TrendRecommendationRecord> = {}
): TrendRecommendationRecord {
  return {
    id: 'rec-1',
    org_id: 'org-1',
    target_setting_key: 'wall_production.base_rate',
    current_value_json: { base_rate: 120 },
    suggested_value_json: { base_rate: 135 },
    reason: 'Labor misses exceeded tolerance for repeated wall production reviews.',
    evidence_json: {
      average_variance: 2.5,
      total_impact: 480,
    },
    evidence_hash: 'hash-1',
    confidence_label: 'high',
    based_on_job_count: 4,
    status: 'open',
    applied_setting_set_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    applied_at: null,
    dismissed_at: null,
    ...overrides,
  }
}

describe('insightsTrendsVm', () => {
  it('formats KPI, variance, and pattern values without recomputing trend metrics', () => {
    const vm = buildInsightsTrendsPageVm(buildSummary())

    expect(vm.kpis.map((kpi) => [kpi.id, kpi.value])).toEqual([
      ['jobs-analyzed', '2'],
      ['average-miss', '+$185'],
      ['portfolio-impact', '+$370'],
      ['labor-variance', '+2.5 hr'],
    ])
    expect(vm.varianceRows.map((row) => [row.id, row.averageVariance, row.averageImpact])).toEqual([
      ['labor', '+2.5 hr', '+$240'],
      ['paint', '-1.3 gal', '-$45'],
      ['supplies', '+$42', '+$42'],
    ])
    expect(vm.patterns[0]).toMatchObject({
      id: 'labor',
      label: 'Labor variance',
      countLabel: '2 metrics',
      averageVariance: '+2.5 hr',
      averageImpact: '+$240',
      totalImpact: '+$480',
    })
  })

  it('marks an empty trend response as having no metrics', () => {
    const vm = buildInsightsTrendsPageVm(
      buildSummary({
        averageLaborVariance: null,
        averagePaintVariance: null,
        averageSuppliesVariance: null,
        averageMissPerJob: null,
        portfolioImpact: 0,
        jobsAnalyzed: 0,
        metrics: {
          labor: { averageVariance: null, averageTotalImpact: null, count: 0 },
          paint: { averageVariance: null, averageTotalImpact: null, count: 0 },
          supplies: { averageVariance: null, averageTotalImpact: null, count: 0 },
        },
        patterns: [],
      })
    )

    expect(vm.hasMetrics).toBe(false)
    expect(vm.jobsAnalyzedLabel).toBe('0 jobs analyzed')
    expect(vm.varianceRows[0].averageVariance).toBe('-')
  })

  it('builds open recommendation cards from recommendation rows', () => {
    const vm = buildInsightsTrendsPageVm(buildSummary(), [
      buildRecommendation(),
      buildRecommendation({ id: 'rec-dismissed', status: 'dismissed' }),
    ])

    expect(vm.recommendationCountLabel).toBe('1 open')
    expect(vm.recommendations).toHaveLength(1)
    expect(vm.recommendations[0]).toMatchObject({
      id: 'rec-1',
      title: 'Wall Production Base Rate',
      targetSettingKey: 'wall_production.base_rate',
      currentValue: 'Base Rate: 120',
      suggestedValue: 'Base Rate: 135',
      confidenceLabel: 'High',
      confidenceTone: 'success',
      reason: 'Labor misses exceeded tolerance for repeated wall production reviews.',
      basedOnJobCountLabel: '4 jobs',
      evidence: ['Average Variance: 2.5', 'Total Impact: 480'],
      isPending: false,
      applyLabel: 'Apply',
      dismissLabel: 'Dismiss',
    })
  })

  it('adds recommendation action labels and apply confirmation state', () => {
    const vm = buildInsightsTrendsPageVm(
      buildSummary(),
      [buildRecommendation()],
      {
        pendingId: 'rec-1',
        pendingAction: 'apply',
        generating: true,
        confirmingApplyId: 'rec-1',
      }
    )

    expect(vm.recommendationGenerateLabel).toBe('Generating')
    expect(vm.recommendationsGenerating).toBe(true)
    expect(vm.recommendations[0]).toMatchObject({
      isPending: true,
      applyLabel: 'Applying',
      dismissLabel: 'Dismiss',
    })
    expect(vm.applyConfirmation).toEqual({
      isOpen: true,
      description: 'Apply Wall Production Base Rate to estimator settings.',
      info: 'Target: wall_production.base_rate. Current value: Base Rate: 120. Suggested value: Base Rate: 135.',
      confirming: true,
    })
  })
})

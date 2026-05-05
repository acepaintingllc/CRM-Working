import { errorResult, okResult, type ServiceResult } from '../serviceResult.ts'
import type {
  TrendRecommendationCandidate,
  TrendRecommendationConfidence,
  TrendRecommendationTarget,
} from '../../../types/estimate-feedback/recommendations.ts'
import type { EstimateFeedbackTrendSummary } from '../../../types/estimate-feedback/trends.ts'
import type {
  EstimatorSettingSetSnapshot,
  EstimatorSettingValueRow,
} from './settingSets.ts'

export const TREND_RECOMMENDATION_POLICY = {
  minimumRuleJobCount: 3,
  laborVarianceThresholdHours: 2,
  suppliesVarianceThresholdDollars: 25,
  stablePaintVarianceThresholdGallons: 0.25,
  adjustmentFactor: 0.1,
  targetCategories: {
    scalarDefaults: 'scalar_defaults',
    wallProductionRates: 'production_rates_walls',
    areaSupplyRates: 'supply_rates_area_based',
  },
  targetFields: {
    value: 'value',
    wallSqftPerHour: 'sqft_per_hr',
    supplyCostPer: 'cost_per',
  },
  scalarTargets: {
    wallsPaintId: 'walls_paint_id',
  },
} as const

const targetTokenPattern = /^[A-Za-z0-9_.-]+$/

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const next = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(next) ? next : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!isRecord(value)) return value
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  )
}

function stableJson(value: unknown) {
  return JSON.stringify(canonicalize(value))
}

function confidenceForCount(count: number): TrendRecommendationConfidence {
  if (count >= 10) return 'high'
  if (count >= 5) return 'medium'
  return 'low'
}

function roundSettingValue(value: number) {
  return Math.round(value * 100) / 100
}

function suggestedAdjustedValue(current: number, variance: number, inverse: boolean) {
  const direction = variance > 0 ? 1 : -1
  const multiplier = inverse
    ? 1 - direction * TREND_RECOMMENDATION_POLICY.adjustmentFactor
    : 1 + direction * TREND_RECOMMENDATION_POLICY.adjustmentFactor
  return roundSettingValue(Math.max(0, current * multiplier))
}

function validTargetToken(token: string) {
  return targetTokenPattern.test(token)
}

export function buildRecommendationTargetKey(target: TrendRecommendationTarget) {
  if (target.kind === 'scalar') {
    return `${TREND_RECOMMENDATION_POLICY.targetCategories.scalarDefaults}:${target.scalarKey}:${target.fieldKey}`
  }
  return `${target.categoryKey}:${target.rowId}:${target.fieldKey}`
}

export function parseRecommendationTargetKey(
  targetKey: unknown
): ServiceResult<TrendRecommendationTarget> {
  const raw = asString(targetKey)
  const parts = raw.split(':')
  if (parts.length !== 3 || parts.some((part) => !validTargetToken(part))) {
    return errorResult('invalid_input', 'Invalid target_setting_key.')
  }

  const [categoryOrScalar, idOrScalar, fieldKey] = parts
  if (!categoryOrScalar || !idOrScalar || !fieldKey) {
    return errorResult('invalid_input', 'Invalid target_setting_key.')
  }

  if (categoryOrScalar === TREND_RECOMMENDATION_POLICY.targetCategories.scalarDefaults) {
    if (fieldKey !== TREND_RECOMMENDATION_POLICY.targetFields.value) {
      return errorResult('invalid_input', 'Scalar target keys must use the value field.')
    }
    return okResult({ kind: 'scalar', scalarKey: idOrScalar, fieldKey })
  }

  return okResult({
    kind: 'row',
    categoryKey: categoryOrScalar,
    rowId: idOrScalar,
    fieldKey,
  })
}

export function targetKeyForSettingValue(value: EstimatorSettingValueRow, fieldKey: string) {
  if (value.row_id) {
    return buildRecommendationTargetKey({
      kind: 'row',
      categoryKey: value.category_key,
      rowId: value.row_id,
      fieldKey,
    })
  }
  if (value.scalar_key) {
    return buildRecommendationTargetKey({
      kind: 'scalar',
      scalarKey: value.scalar_key,
      fieldKey: TREND_RECOMMENDATION_POLICY.targetFields.value,
    })
  }
  return ''
}

function rowValueNumber(value: EstimatorSettingValueRow, fieldKey: string) {
  return asNumber((value.value_json ?? {})[fieldKey])
}

function activeRowWithNumber(
  snapshot: EstimatorSettingSetSnapshot,
  categoryKey: string,
  fieldKey: string
) {
  return snapshot.values.find(
    (value) =>
      value.active &&
      value.category_key === categoryKey &&
      value.row_id &&
      rowValueNumber(value, fieldKey) != null
  )
}

function scalarValue(snapshot: EstimatorSettingSetSnapshot, scalarKey: string) {
  return snapshot.values.find(
    (value) =>
      value.active &&
      value.category_key === TREND_RECOMMENDATION_POLICY.targetCategories.scalarDefaults &&
      value.scalar_key === scalarKey
  )
}

function trendEvidence(params: {
  ruleKey: string
  trend: EstimateFeedbackTrendSummary
  metricKey: 'labor' | 'paint' | 'supplies'
}) {
  const metric = params.trend.metrics[params.metricKey]
  return {
    rule_key: params.ruleKey,
    filters: params.trend.filters,
    metric_key: params.metricKey,
    jobs_analyzed: params.trend.jobsAnalyzed,
    metric_count: metric.count,
    average_variance: metric.averageVariance,
    average_total_impact: metric.averageTotalImpact,
  }
}

function laborRecommendation(
  trend: EstimateFeedbackTrendSummary,
  settingSet: EstimatorSettingSetSnapshot
): TrendRecommendationCandidate | null {
  const metric = trend.metrics.labor
  const variance = metric.averageVariance
  const { laborVarianceThresholdHours, minimumRuleJobCount, targetCategories, targetFields } =
    TREND_RECOMMENDATION_POLICY
  if (
    metric.count < minimumRuleJobCount ||
    variance == null ||
    Math.abs(variance) < laborVarianceThresholdHours
  ) {
    return null
  }

  const row = activeRowWithNumber(
    settingSet,
    targetCategories.wallProductionRates,
    targetFields.wallSqftPerHour
  )
  if (!row) return null
  const current = rowValueNumber(row, targetFields.wallSqftPerHour)
  if (current == null) return null

  const suggested = suggestedAdjustedValue(current, variance, true)
  const direction = variance > 0 ? 'lower' : 'raise'
  return {
    target_setting_key: targetKeyForSettingValue(row, targetFields.wallSqftPerHour),
    current_value_json: { [targetFields.wallSqftPerHour]: current },
    suggested_value_json: { [targetFields.wallSqftPerHour]: suggested },
    reason: `Locked reviews show labor hours averaging ${roundSettingValue(
      variance
    )} hours from estimate; ${direction} the wall production rate by 10%.`,
    evidence_json: trendEvidence({
      ruleKey: 'labor_production_rate_adjustment',
      trend,
      metricKey: 'labor',
    }),
    confidence_label: confidenceForCount(metric.count),
    based_on_job_count: metric.count,
  }
}

function suppliesRecommendation(
  trend: EstimateFeedbackTrendSummary,
  settingSet: EstimatorSettingSetSnapshot
): TrendRecommendationCandidate | null {
  const metric = trend.metrics.supplies
  const variance = metric.averageVariance
  const {
    minimumRuleJobCount,
    suppliesVarianceThresholdDollars,
    targetCategories,
    targetFields,
  } = TREND_RECOMMENDATION_POLICY
  if (
    metric.count < minimumRuleJobCount ||
    variance == null ||
    Math.abs(variance) < suppliesVarianceThresholdDollars
  ) {
    return null
  }

  const row = activeRowWithNumber(
    settingSet,
    targetCategories.areaSupplyRates,
    targetFields.supplyCostPer
  )
  if (!row) return null
  const current = rowValueNumber(row, targetFields.supplyCostPer)
  if (current == null) return null

  const suggested = suggestedAdjustedValue(current, variance, false)
  const direction = variance > 0 ? 'raise' : 'lower'
  return {
    target_setting_key: targetKeyForSettingValue(row, targetFields.supplyCostPer),
    current_value_json: { [targetFields.supplyCostPer]: current },
    suggested_value_json: { [targetFields.supplyCostPer]: suggested },
    reason: `Locked reviews show supplies averaging $${roundSettingValue(
      variance
    )} from estimate; ${direction} the area-based supplies baseline by 10%.`,
    evidence_json: trendEvidence({
      ruleKey: 'supplies_baseline_adjustment',
      trend,
      metricKey: 'supplies',
    }),
    confidence_label: confidenceForCount(metric.count),
    based_on_job_count: metric.count,
  }
}

function stablePaintCoverageRecommendation(
  trend: EstimateFeedbackTrendSummary,
  settingSet: EstimatorSettingSetSnapshot
): TrendRecommendationCandidate | null {
  const metric = trend.metrics.paint
  const variance = metric.averageVariance
  const {
    minimumRuleJobCount,
    scalarTargets,
    stablePaintVarianceThresholdGallons,
    targetFields,
  } = TREND_RECOMMENDATION_POLICY
  if (
    metric.count < minimumRuleJobCount ||
    variance == null ||
    Math.abs(variance) > stablePaintVarianceThresholdGallons
  ) {
    return null
  }

  const row = scalarValue(settingSet, scalarTargets.wallsPaintId)
  if (!row) return null
  const current = (row.value_json ?? {}).value ?? null

  return {
    target_setting_key: targetKeyForSettingValue(row, targetFields.value),
    current_value_json: { [targetFields.value]: current },
    suggested_value_json: { [targetFields.value]: current },
    reason: `Locked reviews show paint gallons averaging ${roundSettingValue(
      variance
    )} gallons from estimate; keep the current wall paint coverage baseline unchanged.`,
    evidence_json: trendEvidence({
      ruleKey: 'stable_paint_coverage_no_change',
      trend,
      metricKey: 'paint',
    }),
    confidence_label: confidenceForCount(metric.count),
    based_on_job_count: metric.count,
  }
}

function valuesEquivalent(actual: unknown, expected: unknown) {
  if (typeof actual === 'number' || typeof expected === 'number') {
    const actualNumber = asNumber(actual)
    const expectedNumber = asNumber(expected)
    return actualNumber != null && expectedNumber != null && actualNumber === expectedNumber
  }
  return stableJson(actual) === stableJson(expected)
}

function recommendationValuesEquivalent(candidate: TrendRecommendationCandidate) {
  const currentKeys = Object.keys(candidate.current_value_json)
  const suggestedKeys = Object.keys(candidate.suggested_value_json)
  if (currentKeys.length !== suggestedKeys.length) return false

  return suggestedKeys.every(
    (key) =>
      Object.hasOwn(candidate.current_value_json, key) &&
      valuesEquivalent(candidate.current_value_json[key], candidate.suggested_value_json[key])
  )
}

export function buildTrendRecommendationCandidates(params: {
  trend: EstimateFeedbackTrendSummary
  activeSettingSet: EstimatorSettingSetSnapshot
}) {
  if (params.trend.jobsAnalyzed < TREND_RECOMMENDATION_POLICY.minimumRuleJobCount) return []
  return [
    laborRecommendation(params.trend, params.activeSettingSet),
    suppliesRecommendation(params.trend, params.activeSettingSet),
    stablePaintCoverageRecommendation(params.trend, params.activeSettingSet),
  ]
    .filter((candidate): candidate is TrendRecommendationCandidate => candidate !== null)
    .filter((candidate) => !recommendationValuesEquivalent(candidate))
}

import { createHash } from 'node:crypto'

import { errorResult, okResult, type ServiceResult } from '../serviceResult.ts'
import { isUuid } from '../routeUtils.ts'
import {
  loadEstimateFeedbackTrends,
  normalizeTrendFilters,
} from './trends.ts'
import type {
  EstimateFeedbackTrendResolvedFilters,
  EstimateFeedbackTrendSummary,
} from '../../../types/estimate-feedback/trends.ts'
import type {
  TrendRecommendationConfidence,
  TrendRecommendationRecord,
  TrendRecommendationStatus,
  TrendRecommendationStatusUpdate,
} from '../../../types/estimate-feedback/recommendations.ts'
import {
  loadActiveSettingSet,
  type EstimatorSettingSetSnapshot,
  type EstimatorSettingValueRow,
} from './settingSets.ts'

export type TrendRecommendationAction = 'generate' | 'update_status'
export type TrendRecommendationRow = TrendRecommendationRecord

export type TrendRecommendationTarget =
  | {
      kind: 'row'
      categoryKey: string
      rowId: string
      fieldKey: string
    }
  | {
      kind: 'scalar'
      scalarKey: string
      fieldKey: 'value'
    }

export type GenerateTrendRecommendationsInput = {
  filters: EstimateFeedbackTrendResolvedFilters
}

export type UpdateTrendRecommendationStatusInput = {
  recommendationId: string
  status: TrendRecommendationStatusUpdate
  appliedSettingSetId: string | null
}

export type ApplyTrendRecommendationInput = {
  recommendationId: string
  actorId: string
}

export type RecommendationPostInput =
  | ({ action: 'generate' } & GenerateTrendRecommendationsInput)
  | ({ action: 'update_status' } & UpdateTrendRecommendationStatusInput)

type DbError = { code?: string | null; message?: string | null }
type QueryResponse<T> = { data: T | null; error: DbError | null }
type QueryListResponse<T> = { data: T[] | null; error: DbError | null }
type QueryBuilder = {
  select(columns: string): QueryBuilder
  eq(column: string, value: unknown): QueryBuilder
  order?(column: string, options?: { ascending?: boolean }): QueryBuilder
  limit?(count: number): QueryBuilder
  insert(payload: Record<string, unknown> | Array<Record<string, unknown>>): QueryBuilder
  update(payload: Record<string, unknown>): QueryBuilder
  maybeSingle<T = unknown>(): Promise<QueryResponse<T>>
  single<T = unknown>(): Promise<QueryResponse<T>>
  then<TResult1 = QueryListResponse<unknown>, TResult2 = never>(
    onfulfilled?: ((value: QueryListResponse<unknown>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>
}
type DbClient = {
  from(table: string): QueryBuilder
  rpc?(name: string, payload: Record<string, unknown>): Promise<QueryResponse<unknown>>
}

type RecommendationCandidate = {
  target_setting_key: string
  current_value_json: Record<string, unknown>
  suggested_value_json: Record<string, unknown>
  reason: string
  evidence_json: Record<string, unknown>
  confidence_label: TrendRecommendationConfidence
  based_on_job_count: number
}

type RecommendationDeps = {
  db?: DbClient
  loadTrends?: (
    orgId: string,
    filters: EstimateFeedbackTrendResolvedFilters
  ) => Promise<ServiceResult<EstimateFeedbackTrendSummary>>
  loadActiveSettingSet?: (params: { orgId: string }) => Promise<EstimatorSettingSetSnapshot | null>
  now?: () => Date
}

const targetTokenPattern = /^[A-Za-z0-9_.-]+$/
const minimumRuleJobCount = 3
const laborVarianceThresholdHours = 2
const suppliesVarianceThresholdDollars = 25
const stablePaintVarianceThresholdGallons = 0.25
const adjustmentFactor = 0.1

const recommendationSelect = [
  'id',
  'org_id',
  'target_setting_key',
  'current_value_json',
  'suggested_value_json',
  'reason',
  'evidence_json',
  'evidence_hash',
  'confidence_label',
  'based_on_job_count',
  'status',
  'applied_setting_set_id',
  'created_at',
  'updated_at',
  'applied_at',
  'dismissed_at',
].join(', ')

async function getDb(deps?: RecommendationDeps): Promise<DbClient> {
  if (deps?.db) return deps.db
  const { supabaseAdmin } = await import('../org.ts')
  return supabaseAdmin as unknown as DbClient
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const next = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(next) ? next : null
}

function asUuid(value: unknown, label: string): ServiceResult<string> {
  const raw = asString(value)
  if (!isUuid(raw)) return errorResult('invalid_input', `Invalid ${label}.`)
  return okResult(raw)
}

function readBodyField(body: Record<string, unknown>, snakeKey: string, camelKey: string) {
  return body[snakeKey] ?? body[camelKey]
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

export function evidenceHash(evidence: Record<string, unknown>) {
  return createHash('sha256').update(stableJson(evidence)).digest('hex')
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
    ? 1 - direction * adjustmentFactor
    : 1 + direction * adjustmentFactor
  return roundSettingValue(Math.max(0, current * multiplier))
}

function validTargetToken(token: string) {
  return targetTokenPattern.test(token)
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

  if (categoryOrScalar === 'scalar_defaults') {
    if (fieldKey !== 'value') {
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
  if (value.row_id) return `${value.category_key}:${value.row_id}:${fieldKey}`
  if (value.scalar_key) return `${value.category_key}:${value.scalar_key}:${fieldKey}`
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
      value.category_key === 'scalar_defaults' &&
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
): RecommendationCandidate | null {
  const metric = trend.metrics.labor
  const variance = metric.averageVariance
  if (
    metric.count < minimumRuleJobCount ||
    variance == null ||
    Math.abs(variance) < laborVarianceThresholdHours
  ) {
    return null
  }

  const row = activeRowWithNumber(settingSet, 'production_rates_walls', 'sqft_per_hr')
  if (!row) return null
  const current = rowValueNumber(row, 'sqft_per_hr')
  if (current == null) return null

  const suggested = suggestedAdjustedValue(current, variance, true)
  const direction = variance > 0 ? 'lower' : 'raise'
  return {
    target_setting_key: targetKeyForSettingValue(row, 'sqft_per_hr'),
    current_value_json: { sqft_per_hr: current },
    suggested_value_json: { sqft_per_hr: suggested },
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
): RecommendationCandidate | null {
  const metric = trend.metrics.supplies
  const variance = metric.averageVariance
  if (
    metric.count < minimumRuleJobCount ||
    variance == null ||
    Math.abs(variance) < suppliesVarianceThresholdDollars
  ) {
    return null
  }

  const row = activeRowWithNumber(settingSet, 'supply_rates_area_based', 'cost_per')
  if (!row) return null
  const current = rowValueNumber(row, 'cost_per')
  if (current == null) return null

  const suggested = suggestedAdjustedValue(current, variance, false)
  const direction = variance > 0 ? 'raise' : 'lower'
  return {
    target_setting_key: targetKeyForSettingValue(row, 'cost_per'),
    current_value_json: { cost_per: current },
    suggested_value_json: { cost_per: suggested },
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
): RecommendationCandidate | null {
  const metric = trend.metrics.paint
  const variance = metric.averageVariance
  if (
    metric.count < minimumRuleJobCount ||
    variance == null ||
    Math.abs(variance) > stablePaintVarianceThresholdGallons
  ) {
    return null
  }

  const row = scalarValue(settingSet, 'walls_paint_id')
  if (!row) return null
  const current = (row.value_json ?? {}).value ?? null

  return {
    target_setting_key: targetKeyForSettingValue(row, 'value'),
    current_value_json: { value: current },
    suggested_value_json: { value: current },
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

export function buildTrendRecommendationCandidates(params: {
  trend: EstimateFeedbackTrendSummary
  settingSet: EstimatorSettingSetSnapshot
}) {
  if (params.trend.jobsAnalyzed < minimumRuleJobCount) return []
  return [
    laborRecommendation(params.trend, params.settingSet),
    suppliesRecommendation(params.trend, params.settingSet),
    stablePaintCoverageRecommendation(params.trend, params.settingSet),
  ]
    .filter((candidate): candidate is RecommendationCandidate => candidate !== null)
    .filter((candidate) => !recommendationValuesEquivalent(candidate))
}

function rowFromCandidate(orgId: string, candidate: RecommendationCandidate) {
  return {
    org_id: orgId,
    ...candidate,
    evidence_hash: evidenceHash(candidate.evidence_json),
    status: 'open',
  }
}

function coerceRecommendationRow(row: TrendRecommendationRow): TrendRecommendationRow {
  return {
    ...row,
    current_value_json: row.current_value_json ?? {},
    suggested_value_json: row.suggested_value_json ?? {},
    evidence_json: row.evidence_json ?? {},
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

function recommendationValuesEquivalent(candidate: RecommendationCandidate) {
  const currentKeys = Object.keys(candidate.current_value_json)
  const suggestedKeys = Object.keys(candidate.suggested_value_json)
  if (currentKeys.length !== suggestedKeys.length) return false

  return suggestedKeys.every(
    (key) =>
      Object.hasOwn(candidate.current_value_json, key) &&
      valuesEquivalent(candidate.current_value_json[key], candidate.suggested_value_json[key])
  )
}

export function normalizeRecommendationStatus(value: unknown): ServiceResult<TrendRecommendationStatus> {
  const raw = asString(value)
  if (raw === 'open' || raw === 'dismissed' || raw === 'applied' || raw === 'stale') {
    return okResult(raw)
  }
  return errorResult('invalid_input', 'status must be open, dismissed, applied, or stale.')
}

export function normalizeRecommendationPostInput(body: unknown): ServiceResult<RecommendationPostInput> {
  if (!isRecord(body)) return errorResult('invalid_input', 'Recommendation payload must be an object.')

  const actionRaw = asString(body.action || 'generate') as TrendRecommendationAction
  if (!actionRaw || actionRaw === 'generate') {
    const filters = normalizeTrendFilters({
      from: readBodyField(body, 'from', 'from'),
      to: readBodyField(body, 'to', 'to'),
      jobType: readBodyField(body, 'job_type', 'jobType'),
      occupancy: readBodyField(body, 'occupancy', 'occupancy'),
      conditionTags: readBodyField(body, 'condition_tags', 'conditionTags'),
      maxAbsoluteVariance: readBodyField(
        body,
        'max_absolute_variance',
        'maxAbsoluteVariance'
      ),
      maxAbsoluteTotalImpact: readBodyField(
        body,
        'max_absolute_total_impact',
        'maxAbsoluteTotalImpact'
      ),
    })
    if (!filters.ok) return filters
    return okResult({ action: 'generate', filters: filters.data })
  }

  if (actionRaw !== 'update_status') {
    return errorResult('invalid_input', 'action must be generate or update_status.')
  }

  const recommendationId = asUuid(
    readBodyField(body, 'recommendation_id', 'recommendationId'),
    'recommendation id'
  )
  if (!recommendationId.ok) return recommendationId

  const status = normalizeRecommendationStatus(readBodyField(body, 'status', 'status'))
  if (!status.ok) return status

  if (status.data === 'applied') {
    return errorResult(
      'invalid_input',
      'Use the dedicated apply endpoint to apply recommendations.'
    )
  }

  const appliedRaw = readBodyField(body, 'applied_setting_set_id', 'appliedSettingSetId')
  const appliedSettingSetId =
    appliedRaw == null || appliedRaw === '' ? okResult(null) : asUuid(appliedRaw, 'applied setting set id')
  if (!appliedSettingSetId.ok) return appliedSettingSetId

  return okResult({
    action: 'update_status',
    recommendationId: recommendationId.data,
    status: status.data,
    appliedSettingSetId: appliedSettingSetId.data,
  })
}

export async function listTrendRecommendations(
  orgId: string,
  status?: TrendRecommendationStatus | null,
  deps?: RecommendationDeps
): Promise<ServiceResult<TrendRecommendationRow[]>> {
  const db = await getDb(deps)
  let query = db
    .from('trend_recommendation')
    .select(recommendationSelect)
    .eq('org_id', orgId)

  if (status) query = query.eq('status', status)
  query = query.order?.('created_at', { ascending: false }) ?? query

  const result = (await query) as QueryListResponse<TrendRecommendationRow>
  if (result.error) {
    return errorResult('server_error', result.error.message ?? 'Unable to load recommendations.')
  }
  return okResult((result.data ?? []).map(coerceRecommendationRow))
}

async function loadTrendRecommendationById(
  orgId: string,
  recommendationId: string,
  deps?: RecommendationDeps
): Promise<ServiceResult<TrendRecommendationRow>> {
  const db = await getDb(deps)
  const result = await db
    .from('trend_recommendation')
    .select(recommendationSelect)
    .eq('org_id', orgId)
    .eq('id', recommendationId)
    .maybeSingle<TrendRecommendationRow>()

  if (result.error) {
    return errorResult('server_error', result.error.message ?? 'Unable to load recommendation.')
  }
  if (!result.data) return errorResult('not_found', 'Recommendation not found.')
  return okResult(coerceRecommendationRow(result.data))
}

export async function generateTrendRecommendations(
  orgId: string,
  input: GenerateTrendRecommendationsInput,
  deps?: RecommendationDeps
): Promise<ServiceResult<TrendRecommendationRow[]>> {
  const loadTrends = deps?.loadTrends ?? loadEstimateFeedbackTrends
  const loadSettingSet = deps?.loadActiveSettingSet ?? loadActiveSettingSet
  const [trend, settingSet] = await Promise.all([
    loadTrends(orgId, input.filters),
    loadSettingSet({ orgId }),
  ])
  if (!trend.ok) return trend
  if (!settingSet) return errorResult('not_found', 'No active estimator setting set found.')

  const candidates = buildTrendRecommendationCandidates({
    trend: trend.data,
    settingSet,
  })
  if (candidates.length === 0) return okResult([])

  const db = await getDb(deps)
  const existingResult = await listTrendRecommendations(orgId, 'open', deps)
  if (!existingResult.ok) return existingResult

  const existingKeys = new Set(
    existingResult.data.map((row) => `${row.target_setting_key}:${row.evidence_hash}`)
  )
  const inserted: TrendRecommendationRow[] = []

  for (const candidate of candidates) {
    const payload = rowFromCandidate(orgId, candidate)
    const key = `${payload.target_setting_key}:${payload.evidence_hash}`
    if (existingKeys.has(key)) {
      const existing = existingResult.data.find(
        (row) =>
          row.target_setting_key === payload.target_setting_key &&
          row.evidence_hash === payload.evidence_hash
      )
      if (existing) inserted.push(existing)
      continue
    }

    const target = parseRecommendationTargetKey(payload.target_setting_key)
    if (!target.ok) return target

    const result = await db
      .from('trend_recommendation')
      .insert(payload)
      .select(recommendationSelect)
      .single<TrendRecommendationRow>()
    if (result.error) {
      if (result.error.code === '23505') continue
      return errorResult(
        'server_error',
        result.error.message ?? 'Unable to create recommendation.'
      )
    }
    if (result.data) {
      inserted.push(coerceRecommendationRow(result.data))
      existingKeys.add(key)
    }
  }

  return okResult(inserted)
}

export async function updateTrendRecommendationStatus(
  orgId: string,
  input: UpdateTrendRecommendationStatusInput,
  deps?: RecommendationDeps
): Promise<ServiceResult<TrendRecommendationRow>> {
  const db = await getDb(deps)
  const now = (deps?.now ?? (() => new Date()))().toISOString()
  const payload = {
    status: input.status,
    applied_setting_set_id: null,
    applied_at: null,
    dismissed_at: input.status === 'dismissed' ? now : null,
  }

  const result = await db
    .from('trend_recommendation')
    .update(payload)
    .eq('org_id', orgId)
    .eq('id', input.recommendationId)
    .select(recommendationSelect)
    .maybeSingle<TrendRecommendationRow>()

  if (result.error) {
    return errorResult('server_error', result.error.message ?? 'Unable to update recommendation.')
  }
  if (!result.data) return errorResult('not_found', 'Recommendation not found.')
  return okResult(coerceRecommendationRow(result.data))
}

export async function applyTrendRecommendation(
  orgId: string,
  input: ApplyTrendRecommendationInput,
  deps?: RecommendationDeps
): Promise<ServiceResult<TrendRecommendationRow>> {
  const db = await getDb(deps)
  if (!db.rpc) return errorResult('server_error', 'Recommendation apply RPC is unavailable.')

  const result = await db.rpc('apply_trend_recommendation', {
    p_org_id: orgId,
    p_recommendation_id: input.recommendationId,
    p_actor_id: input.actorId,
  })

  if (result.error) {
    const message = result.error.message ?? 'Unable to apply recommendation.'
    if (result.error.code === 'P0002' || /not found|no active estimator setting set/i.test(message)) {
      return errorResult('not_found', message)
    }
    if (result.error.code === '22023') return errorResult('invalid_input', message)
    if (result.error.code === '40900' || /no longer open/i.test(message)) {
      return errorResult('conflict', message)
    }
    return errorResult('server_error', message)
  }

  if (!isRecord(result.data)) {
    return errorResult('server_error', 'Unable to apply recommendation.')
  }

  const row = coerceRecommendationRow(result.data as TrendRecommendationRow)
  if (row.status === 'stale') {
    return errorResult(
      'conflict',
      'Recommendation is stale because the active setting value has changed.'
    )
  }

  return okResult(row)
}

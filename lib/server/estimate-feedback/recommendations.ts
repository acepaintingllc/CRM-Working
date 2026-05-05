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
  TrendRecommendationCandidate,
  TrendRecommendationRecord,
  TrendRecommendationStatus,
  TrendRecommendationStatusUpdate,
} from '../../../types/estimate-feedback/recommendations.ts'
import {
  loadActiveSettingSet,
  type EstimatorSettingSetSnapshot,
} from './settingSets.ts'
import {
  buildTrendRecommendationCandidates,
  parseRecommendationTargetKey,
} from './recommendationRules.ts'

export {
  buildRecommendationTargetKey,
  buildTrendRecommendationCandidates,
  parseRecommendationTargetKey,
  targetKeyForSettingValue,
  TREND_RECOMMENDATION_POLICY,
} from './recommendationRules.ts'

export type TrendRecommendationAction = 'generate' | 'update_status'
export type TrendRecommendationRow = TrendRecommendationRecord

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

type RecommendationDeps = {
  db?: DbClient
  loadTrends?: (
    orgId: string,
    filters: EstimateFeedbackTrendResolvedFilters
  ) => Promise<ServiceResult<EstimateFeedbackTrendSummary>>
  loadActiveSettingSet?: (params: { orgId: string }) => Promise<EstimatorSettingSetSnapshot | null>
  now?: () => Date
}

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

function rowFromCandidate(orgId: string, candidate: TrendRecommendationCandidate) {
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
    activeSettingSet: settingSet,
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

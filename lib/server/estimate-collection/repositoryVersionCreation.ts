import { normalizeQuoteVersionKind } from '../../quotes/versionCreation.ts'
import { hasUniqueConstraintConflict } from '../dbErrors.ts'
import { supabaseAdmin } from '../org.ts'
import { errorResult, okResult, type ServiceResult } from '../serviceResult.ts'
import type { EstimateCollectionVersionCopy, EstimateCollectionVersionRow } from './types'
import { asText, estimateSelect, uuid, VERSION_STATES } from './repositoryShared.ts'

type Unsafe = Record<string, unknown>

type QueryError = {
  message: string
}

type MaybeSingleResult<T = Unsafe> = {
  data: T | null
  error: QueryError | null
}

type ManyResult<T = Unsafe> = {
  data: T[] | null
  error: QueryError | null
}

type MutationResult = {
  error: QueryError | null
}

type QueryBuilder<T = Unsafe> = {
  select(columns: string, options?: Record<string, unknown>): QueryBuilder<T>
  eq(column: string, value: unknown): QueryBuilder<T>
  order(column: string, options?: Record<string, unknown>): QueryBuilder<T>
  limit(value: number): QueryBuilder<T>
  maybeSingle(): Promise<MaybeSingleResult<T>>
  single(): Promise<MaybeSingleResult<T>>
  then<TResult1 = ManyResult<T>, TResult2 = never>(
    onfulfilled?: ((value: ManyResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2>
}

type InsertQueryBuilder<T = Unsafe> = {
  insert(payload: Record<string, unknown>): InsertQueryBuilder<T>
  select(columns: string): InsertQueryBuilder<T>
  single(): Promise<MaybeSingleResult<T>>
  then<TResult1 = MutationResult, TResult2 = never>(
    onfulfilled?: ((value: MutationResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2>
}

type FromClient = {
  from(relation: string): unknown
}

type TemplateSettingsRow = {
  walls_paint_id?: string | null
  walls_primer_id?: string | null
  ceiling_paint_id?: string | null
  ceiling_primer_id?: string | null
  trim_paint_id?: string | null
  trim_primer_id?: string | null
  labor_day_policy_enabled?: boolean | null
  dayhours?: number | string | null
  rounding_increment_hours?: number | string | null
  override_labor_rate?: number | string | null
  job_minimum_enabled?: boolean | null
  job_minimum_amount?: number | string | null
}

type SettingValueRow = {
  scalar_key?: string | null
  value_json?: { value?: unknown } | null
}

type EstimateInsertRow = EstimateCollectionVersionRow & {
  org_id?: string | null
}

function asNullableText(value: unknown) {
  const text = asText(value)
  return text || null
}

function asNullableNumber(value: unknown) {
  if (value == null || value === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

function asNullableBoolean(value: unknown) {
  if (value == null || value === '') return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return null
}

function isBrokenCreateEstimateVersionRpcError(message: string) {
  return /coalesce types uuid and text cannot be matched/i.test(message)
}

function buildSettingValueMap(rows: SettingValueRow[] | null) {
  const values = new Map<string, unknown>()
  for (const row of rows ?? []) {
    const key = asText(row.scalar_key)
    if (!key) continue
    values.set(key, row.value_json?.value)
  }
  return values
}

function getTextSetting(
  values: Map<string, unknown>,
  key: string,
  fallback: unknown
) {
  return asNullableText(values.get(key)) ?? asNullableText(fallback)
}

function getBooleanSetting(
  values: Map<string, unknown>,
  key: string,
  fallback: unknown,
  defaultValue: boolean
) {
  return asNullableBoolean(values.get(key)) ?? asNullableBoolean(fallback) ?? defaultValue
}

function getNumberSetting(
  values: Map<string, unknown>,
  key: string,
  fallback: unknown,
  defaultValue: number
) {
  return asNullableNumber(values.get(key)) ?? asNullableNumber(fallback) ?? defaultValue
}

async function createEstimateCollectionVersionFallback(params: {
  from: FromClient['from']
  orgId: string
  userId: string
  jobId: string
  customerId: string | null
  versionState: string
  versionKind: string
  versionName: string | null
  defaultVersionLabel: string
  hasUniqueConstraintConflict: typeof hasUniqueConstraintConflict
}): Promise<ServiceResult<{ id: string; estimate: EstimateCollectionVersionRow }>> {
  const {
    from,
    orgId,
    userId,
    jobId,
    customerId,
    versionState,
    versionKind,
    versionName,
    defaultVersionLabel,
    hasUniqueConstraintConflict: checkConflict,
  } = params

  const jobQuery = from('jobs') as QueryBuilder<{ id?: string | null; customer_id?: string | null }>
  const { data: jobRow, error: jobError } = await jobQuery
    .select('id, customer_id')
    .eq('org_id', orgId)
    .eq('id', jobId)
    .maybeSingle()

  if (jobError) return errorResult('server_error', jobError.message)
  if (!jobRow?.id) return errorResult('not_found', 'Job not found')

  const resolvedCustomerId = customerId || asNullableText(jobRow.customer_id)
  if (!resolvedCustomerId) {
    return errorResult('not_found', 'Customer not found')
  }

  const customerQuery = from('customers') as QueryBuilder<{ id?: string | null }>
  const { data: customerRow, error: customerError } = await customerQuery
    .select('id')
    .eq('org_id', orgId)
    .eq('id', resolvedCustomerId)
    .maybeSingle()

  if (customerError) return errorResult('server_error', customerError.message)
  if (!customerRow?.id) return errorResult('not_found', 'Customer not found')

  const templateQuery = from('estimate_template_settings') as QueryBuilder<TemplateSettingsRow>
  const { data: templateRow, error: templateError } = await templateQuery
    .select(
      [
        'walls_paint_id',
        'walls_primer_id',
        'ceiling_paint_id',
        'ceiling_primer_id',
        'trim_paint_id',
        'trim_primer_id',
        'labor_day_policy_enabled',
        'dayhours',
        'rounding_increment_hours',
        'override_labor_rate',
        'job_minimum_enabled',
        'job_minimum_amount',
      ].join(', ')
    )
    .eq('org_id', orgId)
    .maybeSingle()

  if (templateError) return errorResult('server_error', templateError.message)

  const activeSettingSetQuery = from('estimator_setting_set') as QueryBuilder<{ id?: string | null }>
  const { data: activeSettingSetRow, error: activeSettingSetError } = await activeSettingSetQuery
    .select('id')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .order('version_number', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (activeSettingSetError) return errorResult('server_error', activeSettingSetError.message)

  let settingValueMap = new Map<string, unknown>()
  const settingSetId = asNullableText(activeSettingSetRow?.id)
  if (settingSetId) {
    const settingValuesQuery = from('estimator_setting_value') as QueryBuilder<SettingValueRow>
    const { data: settingValueRows, error: settingValuesError } = (await settingValuesQuery
      .select('scalar_key, value_json')
      .eq('org_id', orgId)
      .eq('setting_set_id', settingSetId)
      .eq('category_key', 'scalar_defaults')) as ManyResult<SettingValueRow>

    if (settingValuesError) return errorResult('server_error', settingValuesError.message)
    settingValueMap = buildSettingValueMap(settingValueRows)
  }

  const template = templateRow ?? {}
  const wallsPrimerId = getTextSetting(settingValueMap, 'walls_primer_id', template.walls_primer_id)
  const ceilingPrimerId = getTextSetting(
    settingValueMap,
    'ceiling_primer_id',
    template.ceiling_primer_id
  )
  const trimPrimerId = getTextSetting(settingValueMap, 'trim_primer_id', template.trim_primer_id)
  const laborDayPolicyEnabled = getBooleanSetting(
    settingValueMap,
    'labor_day_policy_enabled',
    template.labor_day_policy_enabled,
    true
  )
  const dayHours = getNumberSetting(settingValueMap, 'dayhours', template.dayhours, 8)
  const roundingIncrementHours = getNumberSetting(
    settingValueMap,
    'rounding_increment_hours',
    template.rounding_increment_hours,
    4
  )
  const overrideLaborRate = getNumberSetting(
    settingValueMap,
    'override_labor_rate',
    template.override_labor_rate,
    40
  )
  const jobMinimumEnabled = getBooleanSetting(
    settingValueMap,
    'job_minimum_enabled',
    template.job_minimum_enabled,
    false
  )
  const jobMinimumAmount = getNumberSetting(
    settingValueMap,
    'job_minimum_amount',
    template.job_minimum_amount,
    0
  )

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const latestEstimateQuery = from('estimates') as QueryBuilder<{ version_sort_order?: number | null }>
    const { data: latestEstimate, error: latestEstimateError } = await latestEstimateQuery
      .select('version_sort_order')
      .eq('org_id', orgId)
      .eq('job_id', jobId)
      .order('version_sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestEstimateError) return errorResult('server_error', latestEstimateError.message)

    const nextSortOrder = Math.max(-1, Number(latestEstimate?.version_sort_order ?? -1)) + 1
    const resolvedVersionName =
      versionName || `${asText(defaultVersionLabel) || 'Estimate Version'} ${nextSortOrder + 1}`

    const estimatesInsertQuery = from('estimates') as InsertQueryBuilder<EstimateInsertRow>
    const { data: insertedEstimate, error: estimateInsertError } = await estimatesInsertQuery
      .insert({
        org_id: orgId,
        job_id: jobId,
        customer_id: resolvedCustomerId,
        status: 'draft',
        version_name: resolvedVersionName,
        version_state: versionState,
        version_kind: versionKind,
        version_sort_order: nextSortOrder,
        setting_set_id_used: settingSetId,
        created_by: userId,
      })
      .select(estimateSelect)
      .single()

    if (estimateInsertError) {
      if (checkConflict(estimateInsertError)) continue
      return errorResult('server_error', estimateInsertError.message)
    }
    if (!insertedEstimate?.id) {
      return errorResult('server_error', 'Failed to create estimate version.')
    }

    const estimateId = asText(insertedEstimate.id)
    const jobSettingsInsertQuery = from('estimate_jobsettings') as InsertQueryBuilder
    const { error: jobSettingsError } = (await jobSettingsInsertQuery.insert({
      org_id: orgId,
      estimate_id: estimateId,
      job_id: jobId,
      walls_paint_id: getTextSetting(settingValueMap, 'walls_paint_id', template.walls_paint_id),
      walls_primer_id: wallsPrimerId,
      ceiling_paint_id: getTextSetting(
        settingValueMap,
        'ceiling_paint_id',
        template.ceiling_paint_id
      ),
      ceiling_primer_id: ceilingPrimerId,
      trim_paint_id: getTextSetting(settingValueMap, 'trim_paint_id', template.trim_paint_id),
      trim_primer_id: trimPrimerId,
      primer_id: wallsPrimerId || ceilingPrimerId || trimPrimerId,
      labor_day_policy_enabled: laborDayPolicyEnabled,
      dayhours: dayHours,
      rounding_increment_hours: roundingIncrementHours,
      override_labor_rate: overrideLaborRate,
      job_minimum_enabled: jobMinimumEnabled,
      job_minimum_amount: jobMinimumAmount,
    })) as MutationResult

    if (jobSettingsError) return errorResult('server_error', jobSettingsError.message)

    const pricingPoliciesInsertQuery = from('estimate_pricing_policies') as InsertQueryBuilder
    const { error: pricingPoliciesError } = (await pricingPoliciesInsertQuery.insert({
      org_id: orgId,
      estimate_id: estimateId,
      job_id: jobId,
      labor_day_policy_enabled: laborDayPolicyEnabled,
      labor_day_minimum: 1,
      labor_day_rounding_increment: roundingIncrementHours / 8,
      job_minimum_enabled: jobMinimumEnabled,
      job_minimum_amount: jobMinimumAmount,
    })) as MutationResult

    if (pricingPoliciesError) return errorResult('server_error', pricingPoliciesError.message)

    return okResult({
      id: estimateId,
      estimate: insertedEstimate,
    })
  }

  return errorResult('conflict', 'Another version was created at the same time. Please retry.')
}

export async function createEstimateCollectionVersionRecord(params: {
  orgId: string
  userId: string
  body: Record<string, unknown>
  copy: EstimateCollectionVersionCopy
  _deps?: Partial<{
    rpc: typeof supabaseAdmin.rpc
    from: FromClient['from']
    hasUniqueConstraintConflict: typeof hasUniqueConstraintConflict
  }>
}): Promise<ServiceResult<{ id: string; estimate: EstimateCollectionVersionRow }>> {
  const { rpc, from, hasUniqueConstraintConflict: checkConflict } = {
    rpc: supabaseAdmin.rpc.bind(supabaseAdmin),
    from: supabaseAdmin.from.bind(supabaseAdmin),
    hasUniqueConstraintConflict,
    ...(params as {
      _deps?: Partial<{
        rpc: typeof supabaseAdmin.rpc
        from: FromClient['from']
        hasUniqueConstraintConflict: typeof hasUniqueConstraintConflict
      }>
    })._deps,
  }

  const jobId = asText(params.body.job_id)
  if (!uuid.test(jobId)) return errorResult('invalid_input', 'Invalid job_id')

  const customerId = asText(params.body.customer_id)
  if (customerId && !uuid.test(customerId)) {
    return errorResult('invalid_input', 'Invalid customer_id')
  }

  const requestedVersionState = asText(params.body.version_state).toLowerCase()
  const requestedVersionKind = normalizeQuoteVersionKind(asText(params.body.version_kind))
  const versionState = VERSION_STATES.has(requestedVersionState) ? requestedVersionState : 'draft'
  const versionName = asText(params.body.version_name) || null

  const rpcResult = await rpc('create_estimate_version', {
    p_org_id: params.orgId,
    p_user_id: params.userId,
    p_job_id: jobId,
    p_customer_id: customerId || null,
    p_version_state: versionState,
    p_version_kind: requestedVersionKind,
    p_version_name: versionName,
    p_default_version_label: params.copy.defaultVersionLabel,
  })

  if (rpcResult.error) {
    if (checkConflict(rpcResult.error)) {
      return errorResult('conflict', 'Another version was created at the same time. Please retry.')
    }
    if (isBrokenCreateEstimateVersionRpcError(rpcResult.error.message)) {
      return createEstimateCollectionVersionFallback({
        from,
        orgId: params.orgId,
        userId: params.userId,
        jobId,
        customerId: customerId || null,
        versionState,
        versionKind: requestedVersionKind,
        versionName,
        defaultVersionLabel: params.copy.defaultVersionLabel,
        hasUniqueConstraintConflict: checkConflict,
      })
    }
    return errorResult('server_error', rpcResult.error.message)
  }

  const payload = (rpcResult.data ?? null) as
    | {
        ok?: boolean
        error_kind?: string | null
        error_message?: string | null
        id?: string | null
        estimate?: EstimateCollectionVersionRow | null
      }
    | null

  if (!payload?.ok) {
    const errorKind = asText(payload?.error_kind)
    const errorMessage = asText(payload?.error_message) || 'Failed to create estimate version.'
    if (errorKind === 'invalid_input') return errorResult('invalid_input', errorMessage)
    if (errorKind === 'not_found') return errorResult('not_found', errorMessage)
    if (errorKind === 'conflict') return errorResult('conflict', errorMessage)
    return errorResult('server_error', errorMessage)
  }

  return okResult({
    id: asText(payload.id),
    estimate: payload.estimate as EstimateCollectionVersionRow,
  })
}

import { supabaseAdmin } from '../org.ts'
import {
  DEFAULT_DAY_HOURS,
  DEFAULT_ESTIMATE_TEMPLATE_KEY,
  DEFAULT_JOB_MINIMUM_AMOUNT,
  DEFAULT_JOB_MINIMUM_ENABLED,
  DEFAULT_LABOR_DAY_POLICY_ENABLED,
  DEFAULT_LABOR_RATE,
  DEFAULT_QUOTE_VALIDITY_DAYS,
  DEFAULT_ROUNDING_INCREMENT_HOURS,
  DEFAULT_TERMS_TEXT,
} from '../../estimator/defaults.ts'
import type {
  TemplateConstantRowRecord,
  TemplateConstantsRecord,
} from '../rates-flags/categoryTypes.ts'
import type {
  RatesFlagsEditableCategoryKey,
  RatesFlagsMutationRequest,
} from '../../../types/estimator/ratesFlags.ts'

type SupabaseAdminClient = typeof supabaseAdmin
type Unsafe = Record<string, unknown>

export type EstimateTemplateSettingsSnapshot = {
  default_template_key: string
  quote_validity_days: number
  terms_text: string
  walls_paint_id: string | null
  walls_primer_id: string | null
  ceiling_paint_id: string | null
  ceiling_primer_id: string | null
  trim_paint_id: string | null
  trim_primer_id: string | null
  labor_day_policy_enabled: boolean
  dayhours: number
  rounding_increment_hours: number
  override_labor_rate: number
  job_minimum_enabled: boolean
  job_minimum_amount: number
  standard_door_deduction_sf: number
  standard_window_deduction_sf: number
  baseboard_opening_deduction_lf: number
}

export type EstimatorSettingSetStatus = 'draft' | 'active' | 'retired'

export type EstimatorSettingSetRow = {
  id: string
  org_id: string
  version_number: number
  status: EstimatorSettingSetStatus
  source_set_id: string | null
  created_by: string | null
  activated_by: string | null
  retired_by: string | null
  activated_at: string | null
  retired_at: string | null
  notes: string
  created_at: string
  updated_at: string
}

export type EstimatorSettingValueRow = {
  id: string
  org_id: string
  setting_set_id: string
  category_key: string
  row_id: string | null
  scalar_key: string | null
  display_name: string
  active: boolean
  sort_order: number
  value_json: Unsafe | null
}

export type EstimatorSettingSetSnapshot = {
  set: EstimatorSettingSetRow
  values: EstimatorSettingValueRow[]
}

export type EstimatorSettingSetMetadata = Pick<
  EstimatorSettingSetRow,
  | 'id'
  | 'version_number'
  | 'status'
  | 'source_set_id'
  | 'created_at'
  | 'updated_at'
  | 'activated_at'
  | 'retired_at'
  | 'notes'
>

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function asMaybeNumber(value: unknown) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function asNullableText(value: unknown) {
  const text = asText(value)
  return text || null
}

let supabaseAdminProvider: (() => Promise<unknown>) | null = null

async function getSupabaseAdmin(): Promise<SupabaseAdminClient> {
  if (supabaseAdminProvider) return (await supabaseAdminProvider()) as SupabaseAdminClient
  return supabaseAdmin
}

export function setSettingSetsSupabaseAdminProvider(provider: (() => Promise<unknown>) | null) {
  supabaseAdminProvider = provider
}

function settingSetSelectColumns() {
  return [
    'id',
    'org_id',
    'version_number',
    'status',
    'source_set_id',
    'created_by',
    'activated_by',
    'retired_by',
    'activated_at',
    'retired_at',
    'notes',
    'created_at',
    'updated_at',
  ].join(', ')
}

function settingValueSelectColumns() {
  return [
    'id',
    'org_id',
    'setting_set_id',
    'category_key',
    'row_id',
    'scalar_key',
    'display_name',
    'active',
    'sort_order',
    'value_json',
  ].join(', ')
}

async function loadValuesForSet(params: { orgId: string; settingSetId: string }) {
  const client = await getSupabaseAdmin()
  const res = await client
    .from('estimator_setting_value')
    .select(settingValueSelectColumns())
    .eq('org_id', params.orgId)
    .eq('setting_set_id', params.settingSetId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (res.error) throw new Error(res.error.message)
  return ((res.data ?? []) as unknown) as EstimatorSettingValueRow[]
}

export async function loadActiveSettingSet(params: {
  orgId: string
}): Promise<EstimatorSettingSetSnapshot | null> {
  const client = await getSupabaseAdmin()
  const setRes = await client
    .from('estimator_setting_set')
    .select(settingSetSelectColumns())
    .eq('org_id', params.orgId)
    .eq('status', 'active')
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (setRes.error) throw new Error(setRes.error.message)
  if (!setRes.data) return null
  return {
    set: setRes.data as unknown as EstimatorSettingSetRow,
    values: await loadValuesForSet({
      orgId: params.orgId,
      settingSetId: String((setRes.data as unknown as EstimatorSettingSetRow).id),
    }),
  }
}

export async function loadLatestDraftSettingSet(params: {
  orgId: string
}): Promise<EstimatorSettingSetSnapshot | null> {
  const client = await getSupabaseAdmin()
  const setRes = await client
    .from('estimator_setting_set')
    .select(settingSetSelectColumns())
    .eq('org_id', params.orgId)
    .eq('status', 'draft')
    .order('version_number', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (setRes.error) throw new Error(setRes.error.message)
  if (!setRes.data) return null
  const set = setRes.data as unknown as EstimatorSettingSetRow
  return {
    set,
    values: await loadValuesForSet({
      orgId: params.orgId,
      settingSetId: set.id,
    }),
  }
}

export async function loadSettingSetById(params: {
  orgId: string
  settingSetId: string
}): Promise<EstimatorSettingSetSnapshot | null> {
  const client = await getSupabaseAdmin()
  const setRes = await client
    .from('estimator_setting_set')
    .select(settingSetSelectColumns())
    .eq('org_id', params.orgId)
    .eq('id', params.settingSetId)
    .maybeSingle()
  if (setRes.error) throw new Error(setRes.error.message)
  if (!setRes.data) return null
  return {
    set: setRes.data as unknown as EstimatorSettingSetRow,
    values: await loadValuesForSet({ orgId: params.orgId, settingSetId: params.settingSetId }),
  }
}

export async function loadEstimateSettingSet(params: {
  orgId: string
  estimateId: string
}): Promise<EstimatorSettingSetSnapshot | null> {
  const client = await getSupabaseAdmin()
  const estimateRes = await client
    .from('estimates')
    .select('id, setting_set_id_used')
    .eq('org_id', params.orgId)
    .eq('id', params.estimateId)
    .maybeSingle()
  if (estimateRes.error) throw new Error(estimateRes.error.message)
  const settingSetId = String((estimateRes.data as Unsafe | null)?.setting_set_id_used ?? '')
  if (settingSetId) {
    const historical = await loadSettingSetById({
      orgId: params.orgId,
      settingSetId,
    })
    if (historical) return historical
  }
  return loadActiveSettingSet({ orgId: params.orgId })
}

export async function cloneActiveSettingSetAsDraft(params: {
  orgId: string
  userId: string
  notes?: string
}) {
  const client = await getSupabaseAdmin()
  const active = await loadActiveSettingSet({ orgId: params.orgId })
  if (!active) throw new Error('No active estimator setting set found.')

  const versionRes = await client
    .from('estimator_setting_set')
    .select('version_number')
    .eq('org_id', params.orgId)
    .order('version_number', { ascending: false })
    .limit(1)
  if (versionRes.error) throw new Error(versionRes.error.message)
  const nextVersion = Number((versionRes.data?.[0] as Unsafe | undefined)?.version_number ?? 0) + 1

  const draftRes = await client
    .from('estimator_setting_set')
    .insert({
      org_id: params.orgId,
      version_number: nextVersion,
      status: 'draft',
      source_set_id: active.set.id,
      created_by: params.userId,
      notes: params.notes ?? '',
    })
    .select(settingSetSelectColumns())
    .single()
  if (draftRes.error) throw new Error(draftRes.error.message)
  const draft = draftRes.data as unknown as EstimatorSettingSetRow

  if (active.values.length > 0) {
    const insertValues = await client.from('estimator_setting_value').insert(
      active.values.map((value) => ({
        org_id: params.orgId,
        setting_set_id: draft.id,
        category_key: value.category_key,
        row_id: value.row_id,
        scalar_key: value.scalar_key,
        display_name: value.display_name,
        active: value.active,
        sort_order: value.sort_order,
        value_json: value.value_json ?? {},
      }))
    )
    if (insertValues.error) throw new Error(insertValues.error.message)
  }

  return loadSettingSetById({ orgId: params.orgId, settingSetId: draft.id })
}

export async function updateDraftSettingValues(params: {
  orgId: string
  settingSetId: string
  values: Array<{
    category_key: string
    row_id?: string | null
    scalar_key?: string | null
    display_name?: string
    active?: boolean
    sort_order?: number
    value_json: Unsafe
  }>
}) {
  const draft = await loadSettingSetById({
    orgId: params.orgId,
    settingSetId: params.settingSetId,
  })
  if (!draft) throw new Error('Setting set not found.')
  if (draft.set.status !== 'draft') throw new Error('Only draft setting sets can be updated.')
  if (params.values.length === 0) return draft

  const client = await getSupabaseAdmin()
  for (const value of params.values) {
    const rowId = value.row_id ?? null
    const scalarKey = value.scalar_key ?? null
    const existing = draft.values.find(
      (candidate) =>
        candidate.category_key === value.category_key &&
        (rowId ? candidate.row_id === rowId : candidate.scalar_key === scalarKey)
    )
    const payload = {
      category_key: value.category_key,
      row_id: rowId,
      scalar_key: scalarKey,
      display_name: value.display_name ?? rowId ?? scalarKey ?? value.category_key,
      active: value.active ?? true,
      sort_order: value.sort_order ?? 0,
      value_json: value.value_json,
    }
    if (existing) {
      const update = await client
        .from('estimator_setting_value')
        .update(payload)
        .eq('org_id', params.orgId)
        .eq('id', existing.id)
      if (update.error) throw new Error(update.error.message)
    } else {
      const insert = await client.from('estimator_setting_value').insert({
        org_id: params.orgId,
        setting_set_id: params.settingSetId,
        ...payload,
      })
      if (insert.error) throw new Error(insert.error.message)
    }
  }
  return loadSettingSetById({ orgId: params.orgId, settingSetId: params.settingSetId })
}

export async function updateDraftSettingRowValue(params: {
  orgId: string
  settingSetId: string
  categoryKey: RatesFlagsEditableCategoryKey
  originalRowId?: string | null
  rowId: string
  displayName: string
  active: boolean
  sortOrder?: number
  valueJson: Unsafe
}) {
  const draft = await loadSettingSetById({
    orgId: params.orgId,
    settingSetId: params.settingSetId,
  })
  if (!draft) throw new Error('Setting set not found.')
  if (draft.set.status !== 'draft') throw new Error('Only draft setting sets can be updated.')

  const originalRowId = asText(params.originalRowId) || params.rowId
  const existing = draft.values.find(
    (candidate) =>
      candidate.category_key === params.categoryKey && candidate.row_id === originalRowId
  )
  const collision = draft.values.find(
    (candidate) =>
      candidate.category_key === params.categoryKey &&
      candidate.row_id === params.rowId &&
      candidate.id !== existing?.id
  )
  if (collision) throw new Error(`Row '${params.rowId}' already exists.`)

  const categoryValues = draft.values.filter(
    (candidate) => candidate.category_key === params.categoryKey
  )
  const nextSortOrder =
    params.sortOrder ??
    existing?.sort_order ??
    categoryValues.reduce((max, value) => Math.max(max, value.sort_order), -1) + 1
  const payload = {
    category_key: params.categoryKey,
    row_id: params.rowId,
    scalar_key: null,
    display_name: params.displayName,
    active: params.active,
    sort_order: nextSortOrder,
    value_json: params.valueJson,
  }

  const client = await getSupabaseAdmin()
  if (existing) {
    const update = await client
      .from('estimator_setting_value')
      .update(payload)
      .eq('org_id', params.orgId)
      .eq('id', existing.id)
    if (update.error) throw new Error(update.error.message)
  } else {
    const insert = await client.from('estimator_setting_value').insert({
      org_id: params.orgId,
      setting_set_id: params.settingSetId,
      ...payload,
    })
    if (insert.error) throw new Error(insert.error.message)
  }

  return loadSettingSetById({ orgId: params.orgId, settingSetId: params.settingSetId })
}

export function settingSetMetadata(
  snapshot: EstimatorSettingSetSnapshot | null
): EstimatorSettingSetMetadata | null {
  if (!snapshot) return null
  return {
    id: snapshot.set.id,
    version_number: snapshot.set.version_number,
    status: snapshot.set.status,
    source_set_id: snapshot.set.source_set_id,
    created_at: snapshot.set.created_at,
    updated_at: snapshot.set.updated_at,
    activated_at: snapshot.set.activated_at,
    retired_at: snapshot.set.retired_at,
    notes: snapshot.set.notes,
  }
}

export async function writeSettingChangeLog(params: {
  orgId: string
  previousSettingSetId?: string | null
  newSettingSetId?: string | null
  targetKey: string
  oldValueJson?: Unsafe | null
  newValueJson?: Unsafe | null
  source?: string
  reason?: string
  actorId?: string | null
  recommendationId?: string | null
}) {
  const client = await getSupabaseAdmin()
  const insert = await client.from('setting_change_log').insert({
    org_id: params.orgId,
    previous_setting_set_id: params.previousSettingSetId ?? null,
    new_setting_set_id: params.newSettingSetId ?? null,
    target_key: params.targetKey,
    old_value_json: params.oldValueJson ?? null,
    new_value_json: params.newValueJson ?? null,
    source: params.source ?? 'manual',
    reason: params.reason ?? '',
    actor_id: params.actorId ?? null,
    recommendation_id: params.recommendationId ?? null,
  })
  if (insert.error) throw new Error(insert.error.message)
}

export async function activateDraftSettingSet(params: {
  orgId: string
  settingSetId: string
  userId: string
  reason?: string
  source?: string
}) {
  const draft = await loadSettingSetById({
    orgId: params.orgId,
    settingSetId: params.settingSetId,
  })
  if (!draft) throw new Error('Setting set not found.')
  if (draft.set.status !== 'draft') throw new Error('Only draft setting sets can be activated.')

  const client = await getSupabaseAdmin()
  const result = await client.rpc('activate_estimator_setting_set', {
    p_org_id: params.orgId,
    p_setting_set_id: params.settingSetId,
    p_actor_id: params.userId,
    p_reason: params.reason ?? '',
    p_source: params.source ?? 'manual',
  })
  if (result.error) throw new Error(result.error.message)

  return loadSettingSetById({ orgId: params.orgId, settingSetId: params.settingSetId })
}

export async function publishRatesFlagsSettingSetBatch(params: {
  orgId: string
  userId: string
  mutations: RatesFlagsMutationRequest[]
  reason?: string
  source?: string
}) {
  const client = await getSupabaseAdmin()
  const result = await client.rpc('publish_estimator_rates_flags_batch', {
    p_org_id: params.orgId,
    p_actor_id: params.userId,
    p_mutations: params.mutations,
    p_reason: params.reason ?? '',
    p_source: params.source ?? 'rates_flags_batch_publish',
  })
  if (result.error) throw new Error(result.error.message)

  const data = (result.data ?? {}) as Unsafe
  const settingSetId =
    asText(data.setting_set_id) ||
    asText(((data.setting_set as Unsafe | undefined) ?? {}).id)
  if (!settingSetId) throw new Error('Published setting set id was not returned.')

  return {
    settingSet: await loadSettingSetById({ orgId: params.orgId, settingSetId }),
    draftEstimatesUpdated: asMaybeNumber(data.draft_estimates_updated),
  }
}

export function settingValuesToTemplateRows(
  snapshot: EstimatorSettingSetSnapshot
): TemplateConstantRowRecord[] {
  return snapshot.values
    .filter((value) => value.row_id)
    .map((value) => ({
      id: value.id,
      org_id: value.org_id,
      template_id: value.setting_set_id,
      category_key: value.category_key as RatesFlagsEditableCategoryKey,
      row_id: String(value.row_id),
      display_name: value.display_name,
      active: value.active ? 'Y' : 'N',
      sort_order: value.sort_order,
      values_json: (value.value_json ?? {}) as TemplateConstantRowRecord['values_json'],
    }))
}

export function settingSetToTemplateRecord(
  snapshot: EstimatorSettingSetSnapshot
): TemplateConstantsRecord {
  return {
    id: snapshot.set.id,
    org_id: snapshot.set.org_id,
    version: snapshot.set.version_number,
    seeded_at: snapshot.set.activated_at ?? snapshot.set.created_at,
  }
}

export function settingValuesToEstimateTemplateSettings(
  snapshot: EstimatorSettingSetSnapshot | null
): EstimateTemplateSettingsSnapshot {
  const row: Unsafe = {}
  for (const value of snapshot?.values ?? []) {
    if (value.category_key !== 'scalar_defaults' || !value.scalar_key) continue
    row[value.scalar_key] = (value.value_json as Unsafe | null)?.value
  }
  return {
    default_template_key: asText(row.default_template_key) || DEFAULT_ESTIMATE_TEMPLATE_KEY,
    quote_validity_days: asMaybeNumber(row.quote_validity_days) ?? DEFAULT_QUOTE_VALIDITY_DAYS,
    terms_text: asText(row.terms_text) || DEFAULT_TERMS_TEXT,
    walls_paint_id: asNullableText(row.walls_paint_id),
    walls_primer_id: asNullableText(row.walls_primer_id),
    ceiling_paint_id: asNullableText(row.ceiling_paint_id),
    ceiling_primer_id: asNullableText(row.ceiling_primer_id),
    trim_paint_id: asNullableText(row.trim_paint_id),
    trim_primer_id: asNullableText(row.trim_primer_id),
    labor_day_policy_enabled:
      typeof row.labor_day_policy_enabled === 'boolean'
        ? row.labor_day_policy_enabled
        : DEFAULT_LABOR_DAY_POLICY_ENABLED,
    dayhours: asMaybeNumber(row.dayhours) ?? DEFAULT_DAY_HOURS,
    rounding_increment_hours:
      asMaybeNumber(row.rounding_increment_hours) ?? DEFAULT_ROUNDING_INCREMENT_HOURS,
    override_labor_rate: asMaybeNumber(row.override_labor_rate) ?? DEFAULT_LABOR_RATE,
    job_minimum_enabled:
      typeof row.job_minimum_enabled === 'boolean'
        ? row.job_minimum_enabled
        : DEFAULT_JOB_MINIMUM_ENABLED,
    job_minimum_amount: asMaybeNumber(row.job_minimum_amount) ?? DEFAULT_JOB_MINIMUM_AMOUNT,
    standard_door_deduction_sf: asMaybeNumber(row.standard_door_deduction_sf) ?? 21,
    standard_window_deduction_sf: asMaybeNumber(row.standard_window_deduction_sf) ?? 15,
    baseboard_opening_deduction_lf: asMaybeNumber(row.baseboard_opening_deduction_lf) ?? 3,
  }
}

export const _test = {
  publishRatesFlagsSettingSetBatch,
  setSettingSetsSupabaseAdminProvider,
  settingSetMetadata,
  settingSetToTemplateRecord,
  settingValuesToEstimateTemplateSettings,
  settingValuesToTemplateRows,
}

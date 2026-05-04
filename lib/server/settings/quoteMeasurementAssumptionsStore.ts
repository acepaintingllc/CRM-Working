import {
  normalizeQuoteMeasurementAssumptions,
  parseQuoteMeasurementAssumptions,
} from '../../quotes/measurementAssumptionsForm.ts'
import type { QuoteMeasurementAssumptions } from '../../settings/types.ts'
import {
  activateDraftSettingSet,
  cloneActiveSettingSetAsDraft,
  loadActiveSettingSet,
  settingValuesToEstimateTemplateSettings,
  updateDraftSettingValues,
  type EstimatorSettingSetSnapshot,
} from '../estimate-feedback/settingSets.ts'
import { supabaseAdmin } from '../org.ts'

type Unsafe = Record<string, unknown>

type QueryError = {
  message: string
}

type MaybeSingleResult = {
  data: Unsafe | null
  error: QueryError | null
}

type SingleResult = {
  data: Unsafe | null
  error: QueryError | null
}

type SettingsQuery = {
  select(columns: string): SettingsQuery
  eq(column: string, value: string): SettingsQuery
  maybeSingle(): Promise<MaybeSingleResult>
  single(): Promise<SingleResult>
  upsert(payload: Record<string, unknown>, options: { onConflict: string }): SettingsQuery
}

export type QuoteMeasurementAssumptionsStoreDeps = {
  client: {
    from(relation: string): unknown
  }
  loadActiveSettingSet: typeof loadActiveSettingSet
  cloneActiveSettingSetAsDraft: typeof cloneActiveSettingSetAsDraft
  updateDraftSettingValues: typeof updateDraftSettingValues
  activateDraftSettingSet: typeof activateDraftSettingSet
}

export class QuoteMeasurementAssumptionsValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QuoteMeasurementAssumptionsValidationError'
  }
}

const defaultDeps: QuoteMeasurementAssumptionsStoreDeps = {
  client: supabaseAdmin,
  loadActiveSettingSet,
  cloneActiveSettingSetAsDraft,
  updateDraftSettingValues,
  activateDraftSettingSet,
}

function withDeps(
  overrides: Partial<QuoteMeasurementAssumptionsStoreDeps> = {}
): QuoteMeasurementAssumptionsStoreDeps {
  return {
    ...defaultDeps,
    ...overrides,
  }
}

const measurementAssumptionColumns =
  'standard_door_deduction_sf, standard_window_deduction_sf, baseboard_opening_deduction_lf'

export async function loadQuoteMeasurementAssumptions(
  orgId: string,
  deps: Partial<QuoteMeasurementAssumptionsStoreDeps> = {}
) {
  const allDeps = withDeps(deps)
  const active = await allDeps.loadActiveSettingSet({ orgId })
  if (active) {
    return normalizeQuoteMeasurementAssumptions(
      settingValuesToEstimateTemplateSettings(active) as Unsafe
    )
  }

  const { client } = allDeps
  // Compatibility fallback only for orgs not yet backfilled to setting sets.
  const res = await (client.from('estimate_template_settings') as SettingsQuery)
    .select(measurementAssumptionColumns)
    .eq('org_id', orgId)
    .maybeSingle()

  if (res.error) throw new Error(res.error.message)
  return normalizeQuoteMeasurementAssumptions((res.data ?? null) as Unsafe | null)
}

export async function saveQuoteMeasurementAssumptions(
  orgId: string,
  data: QuoteMeasurementAssumptions,
  userIdOrDeps: string | Partial<QuoteMeasurementAssumptionsStoreDeps> = 'system',
  maybeDeps: Partial<QuoteMeasurementAssumptionsStoreDeps> = {}
) {
  const userId = typeof userIdOrDeps === 'string' ? userIdOrDeps : 'system'
  const deps = typeof userIdOrDeps === 'string' ? maybeDeps : userIdOrDeps
  const parsed = parseQuoteMeasurementAssumptions(data)
  if (!parsed.ok) {
    throw new QuoteMeasurementAssumptionsValidationError(parsed.error)
  }

  const allDeps = withDeps(deps)
  const { client } = allDeps
  const draft = await allDeps.cloneActiveSettingSetAsDraft({
    orgId,
    userId,
    notes: 'Measurement assumptions draft',
  })
  if (!draft) throw new Error('Failed to create measurement assumptions setting draft.')

  const updated = await allDeps.updateDraftSettingValues({
    orgId,
    settingSetId: draft.set.id,
    values: measurementAssumptionsToScalarValues(parsed.data, draft),
  })
  if (!updated) throw new Error('Failed to update measurement assumptions setting draft.')

  const activated = await allDeps.activateDraftSettingSet({
    orgId,
    settingSetId: updated.set.id,
    userId,
    reason: 'Measurement assumptions saved',
    source: 'measurement_assumptions_admin',
  })
  if (!activated) throw new Error('Failed to activate measurement assumptions setting set.')

  await mirrorMeasurementAssumptionsCompatibility(client, orgId, parsed.data)

  return normalizeQuoteMeasurementAssumptions(
    settingValuesToEstimateTemplateSettings(activated) as Unsafe
  )
}

function measurementAssumptionsToScalarValues(
  data: QuoteMeasurementAssumptions,
  draft: EstimatorSettingSetSnapshot
) {
  const keys: Array<keyof QuoteMeasurementAssumptions> = [
    'standard_door_deduction_sf',
    'standard_window_deduction_sf',
    'baseboard_opening_deduction_lf',
  ]

  return keys.map((key, index) => {
    const existing = draft.values.find(
      (value) => value.category_key === 'scalar_defaults' && value.scalar_key === key
    )
    return {
      category_key: 'scalar_defaults',
      scalar_key: key,
      row_id: null,
      display_name: existing?.display_name ?? key,
      active: true,
      sort_order: existing?.sort_order ?? index,
      value_json: { value: data[key] },
    }
  })
}

async function mirrorMeasurementAssumptionsCompatibility(
  client: QuoteMeasurementAssumptionsStoreDeps['client'],
  orgId: string,
  data: QuoteMeasurementAssumptions
) {
  const res = await (client.from('estimate_template_settings') as SettingsQuery)
    .upsert(
      {
        org_id: orgId,
        ...data,
      },
      { onConflict: 'org_id' }
    )
    .select(measurementAssumptionColumns)
    .single()

  if (res.error) {
    console.error(
      '[quote-measurement-assumptions] compatibility mirror failed',
      res.error.message
    )
  }
}

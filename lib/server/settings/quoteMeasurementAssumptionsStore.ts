import {
  normalizeQuoteMeasurementAssumptions,
  parseQuoteMeasurementAssumptions,
} from '../../quotes/measurementAssumptionsForm.ts'
import type { QuoteMeasurementAssumptions } from '../../settings/types.ts'
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
}

export class QuoteMeasurementAssumptionsValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QuoteMeasurementAssumptionsValidationError'
  }
}

const defaultDeps: QuoteMeasurementAssumptionsStoreDeps = {
  client: supabaseAdmin,
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
  const { client } = withDeps(deps)
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
  deps: Partial<QuoteMeasurementAssumptionsStoreDeps> = {}
) {
  const parsed = parseQuoteMeasurementAssumptions(data)
  if (!parsed.ok) {
    throw new QuoteMeasurementAssumptionsValidationError(parsed.error)
  }

  const { client } = withDeps(deps)
  const res = await (client.from('estimate_template_settings') as SettingsQuery)
    .upsert(
      {
        org_id: orgId,
        ...parsed.data,
      },
      { onConflict: 'org_id' }
    )
    .select(measurementAssumptionColumns)
    .single()

  if (res.error) throw new Error(res.error.message)
  return normalizeQuoteMeasurementAssumptions(res.data as Unsafe | null)
}

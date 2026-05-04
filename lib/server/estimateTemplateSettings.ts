import { supabaseAdmin } from '@/lib/server/org'
import {
  loadActiveSettingSet,
  loadEstimateSettingSet,
  loadSettingSetById,
  settingValuesToEstimateTemplateSettings,
} from '@/lib/server/estimate-feedback/settingSets'
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
} from '@/lib/estimator/defaults'

type Unsafe = Record<string, unknown>

export type EstimateTemplateSettingsRow = {
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

export function normalizeEstimateTemplateSettings(row: Unsafe | null | undefined): EstimateTemplateSettingsRow {
  return {
    default_template_key: asText(row?.default_template_key) || DEFAULT_ESTIMATE_TEMPLATE_KEY,
    quote_validity_days: asMaybeNumber(row?.quote_validity_days) ?? DEFAULT_QUOTE_VALIDITY_DAYS,
    terms_text: asText(row?.terms_text) || DEFAULT_TERMS_TEXT,
    walls_paint_id: asNullableText(row?.walls_paint_id),
    walls_primer_id: asNullableText(row?.walls_primer_id),
    ceiling_paint_id: asNullableText(row?.ceiling_paint_id),
    ceiling_primer_id: asNullableText(row?.ceiling_primer_id),
    trim_paint_id: asNullableText(row?.trim_paint_id),
    trim_primer_id: asNullableText(row?.trim_primer_id),
    labor_day_policy_enabled:
      typeof row?.labor_day_policy_enabled === 'boolean'
        ? row.labor_day_policy_enabled
        : DEFAULT_LABOR_DAY_POLICY_ENABLED,
    dayhours: asMaybeNumber(row?.dayhours) ?? DEFAULT_DAY_HOURS,
    rounding_increment_hours:
      asMaybeNumber(row?.rounding_increment_hours) ?? DEFAULT_ROUNDING_INCREMENT_HOURS,
    override_labor_rate: asMaybeNumber(row?.override_labor_rate) ?? DEFAULT_LABOR_RATE,
    job_minimum_enabled:
      typeof row?.job_minimum_enabled === 'boolean'
        ? row.job_minimum_enabled
        : DEFAULT_JOB_MINIMUM_ENABLED,
    job_minimum_amount:
      asMaybeNumber(row?.job_minimum_amount) ?? DEFAULT_JOB_MINIMUM_AMOUNT,
    standard_door_deduction_sf: asMaybeNumber(row?.standard_door_deduction_sf) ?? 21,
    standard_window_deduction_sf: asMaybeNumber(row?.standard_window_deduction_sf) ?? 15,
    baseboard_opening_deduction_lf: asMaybeNumber(row?.baseboard_opening_deduction_lf) ?? 3,
  }
}

async function loadCompatibilityEstimateTemplateSettings(orgId: string) {
  // Compatibility fallback only for orgs without Prompt 1 setting-set backfill.
  // Estimate-specific callers resolve scalar defaults through setting sets first.
  const res = await supabaseAdmin
    .from('estimate_template_settings')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()
  if (res.error) throw new Error(res.error.message)
  return normalizeEstimateTemplateSettings((res.data ?? null) as Unsafe | null)
}

export async function loadEstimateTemplateSettings(
  orgIdOrParams:
    | string
    | {
        orgId: string
        estimateId?: string | null
        settingSetId?: string | null
        compatibilityFallback?: boolean
      }
) {
  const params =
    typeof orgIdOrParams === 'string'
      ? { orgId: orgIdOrParams, compatibilityFallback: true }
      : orgIdOrParams

  const snapshot = params.settingSetId
    ? await loadSettingSetById({
        orgId: params.orgId,
        settingSetId: params.settingSetId,
      })
    : params.estimateId
      ? await loadEstimateSettingSet({
          orgId: params.orgId,
          estimateId: params.estimateId,
        })
      : await loadActiveSettingSet({ orgId: params.orgId })

  if (snapshot) return settingValuesToEstimateTemplateSettings(snapshot)

  if (params.compatibilityFallback !== false) {
    return loadCompatibilityEstimateTemplateSettings(params.orgId)
  }

  return normalizeEstimateTemplateSettings(null)
}

export const _test = {
  loadCompatibilityEstimateTemplateSettings,
}

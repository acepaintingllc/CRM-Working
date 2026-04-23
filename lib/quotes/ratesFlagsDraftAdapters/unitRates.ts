import type {
  DoorUnitRateDraft,
  DrywallUnitRateDraft,
  RatesFlagsCategoryValueMap,
  TrimUnitRateDraft,
} from '../../../types/estimator/ratesFlags'
import { buildAdapter } from './buildAdapter.ts'
import { asDraftNumberString, asDraftString, asDraftYN } from './shared.ts'

function buildUnitRateValues<TKey extends 'unit_rates_doors' | 'unit_rates_trim' | 'unit_rates_drywall'>(
  categoryKey: TKey,
  draft: DoorUnitRateDraft | TrimUnitRateDraft | DrywallUnitRateDraft,
  draftActive: boolean
) {
  const common = {
    id: asDraftString(draft.id),
    display_name: asDraftString(draft.display_name),
    unit_rate_type: asDraftString(draft.unit_rate_type),
    unit: asDraftString(draft.unit),
    default_qty: asDraftNumberString(draft.default_qty),
    labor_rate: asDraftNumberString(draft.labor_rate),
    material_rate: asDraftNumberString(draft.material_rate),
    amount: asDraftNumberString(draft.amount),
    notes: asDraftString(draft.notes),
    active: draftActive ? 'Y' : 'N',
  }

  if (categoryKey === 'unit_rates_trim') {
    const trimDraft = draft as TrimUnitRateDraft
    return {
      ...common,
      unit_rate_group: 'trim',
      helper_allowed: asDraftYN(trimDraft.helper_allowed),
      default_production_rate_id: asDraftString(trimDraft.default_production_rate_id),
    } as RatesFlagsCategoryValueMap[TKey]
  }

  return {
    ...common,
    unit_rate_group: categoryKey === 'unit_rates_doors' ? 'doors' : 'drywall',
  } as RatesFlagsCategoryValueMap[TKey]
}

export const unitRatesDraftAdapters = {
  unit_rates_doors: buildAdapter({
    key: 'unit_rates_doors',
    toValues: (draft: DoorUnitRateDraft, draftActive) =>
      buildUnitRateValues('unit_rates_doors', draft, draftActive),
  }),
  unit_rates_trim: buildAdapter({
    key: 'unit_rates_trim',
    toValues: (draft: TrimUnitRateDraft, draftActive) =>
      buildUnitRateValues('unit_rates_trim', draft, draftActive),
  }),
  unit_rates_drywall: buildAdapter({
    key: 'unit_rates_drywall',
    toValues: (draft: DrywallUnitRateDraft, draftActive) =>
      buildUnitRateValues('unit_rates_drywall', draft, draftActive),
  }),
}

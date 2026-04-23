import type {
  RatesFlagsCategoryValueMap,
  RatesFlagsDraftByCategory,
  RollerCoverSupplyRateDraft,
  SupplyRateDraft,
} from '../../../types/estimator/ratesFlags'
import { buildAdapter } from './buildAdapter.ts'
import { asDraftNumberString, asDraftString } from './shared.ts'

function buildSupplyValues<TKey extends 'supply_rates_per_color' | 'supply_rates_area_based' | 'supply_rates_per_job'>(
  categoryKey: TKey,
  draft: RatesFlagsDraftByCategory[TKey] | SupplyRateDraft,
  draftActive: boolean
) {
  return {
    supply_group:
      categoryKey === 'supply_rates_per_color'
        ? 'per_color'
        : categoryKey === 'supply_rates_area_based'
          ? 'area_based'
          : 'per_job',
    id: asDraftString(draft.id),
    display_name: asDraftString(draft.display_name),
    scope: asDraftString(draft.scope),
    unit: categoryKey === 'supply_rates_area_based' ? '$/sqft' : asDraftString(draft.unit),
    cost_per: asDraftNumberString(draft.cost_per),
    notes: asDraftString(draft.notes),
    active: draftActive ? 'Y' : 'N',
  } as RatesFlagsCategoryValueMap[TKey]
}

export const supplyRatesDraftAdapters = {
  supply_rates_per_color: buildAdapter({
    key: 'supply_rates_per_color',
    toValues: (draft: SupplyRateDraft, draftActive) =>
      buildSupplyValues('supply_rates_per_color', draft, draftActive),
  }),
  supply_rates_area_based: buildAdapter({
    key: 'supply_rates_area_based',
    toValues: (draft: SupplyRateDraft, draftActive) =>
      buildSupplyValues('supply_rates_area_based', draft, draftActive),
  }),
  supply_rates_per_job: buildAdapter({
    key: 'supply_rates_per_job',
    toValues: (draft: SupplyRateDraft, draftActive) =>
      buildSupplyValues('supply_rates_per_job', draft, draftActive),
  }),
  supply_rates_roller_covers: buildAdapter({
    key: 'supply_rates_roller_covers',
    toValues: (draft: RollerCoverSupplyRateDraft, draftActive) =>
      ({
        supply_group: 'roller_covers',
        id: asDraftString(draft.id),
        display_name: asDraftString(draft.display_name),
        scope: asDraftString(draft.scope),
        size_in: asDraftNumberString(draft.size_in),
        price_each: asDraftNumberString(draft.price_each),
        notes: asDraftString(draft.notes),
        active: draftActive ? 'Y' : 'N',
      }) as RatesFlagsCategoryValueMap['supply_rates_roller_covers'],
  }),
}

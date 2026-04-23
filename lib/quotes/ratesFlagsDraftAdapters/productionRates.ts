import type { ProductionRateDraft } from '../../../types/estimator/ratesFlags'
import { buildAdapter } from './buildAdapter.ts'
import { buildProductionRateValues } from './shared.ts'

export const productionRatesDraftAdapters = {
  production_rates_walls: buildAdapter({
    key: 'production_rates_walls',
    toValues: (draft: ProductionRateDraft, draftActive) =>
      buildProductionRateValues('production_rates_walls', draft, draftActive),
  }),
  production_rates_ceilings: buildAdapter({
    key: 'production_rates_ceilings',
    toValues: (draft: ProductionRateDraft, draftActive) =>
      buildProductionRateValues('production_rates_ceilings', draft, draftActive),
  }),
  production_rates_trim: buildAdapter({
    key: 'production_rates_trim',
    toValues: (draft: ProductionRateDraft, draftActive) =>
      buildProductionRateValues('production_rates_trim', draft, draftActive),
  }),
}

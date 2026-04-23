import type { RatesFlagsEditableCategoryKey } from '../../../types/estimator/ratesFlags'
import { accessFeesDraftAdapters } from './accessFees.ts'
import { multipliersDraftAdapters } from './multipliers.ts'
import { productionRatesDraftAdapters } from './productionRates.ts'
import { roomDefaultsDraftAdapters } from './roomDefaults.ts'
import { supplyRatesDraftAdapters } from './supplyRates.ts'
import type { RatesFlagsDraftAdapter } from './types.ts'
import { unitRatesDraftAdapters } from './unitRates.ts'

export const ratesFlagsDraftAdapters = {
  ...productionRatesDraftAdapters,
  ...unitRatesDraftAdapters,
  ...accessFeesDraftAdapters,
  ...supplyRatesDraftAdapters,
  ...multipliersDraftAdapters,
  ...roomDefaultsDraftAdapters,
} satisfies {
  [TKey in RatesFlagsEditableCategoryKey]: RatesFlagsDraftAdapter<TKey>
}

export function getRatesFlagsDraftAdapter<TKey extends RatesFlagsEditableCategoryKey>(
  key: TKey
): RatesFlagsDraftAdapter<TKey> {
  return ratesFlagsDraftAdapters[key] as unknown as RatesFlagsDraftAdapter<TKey>
}

import type { CategoryConfig, RatesFlagsEditableCategoryKey } from './categoryTypes.ts'
import { ratesFlagsEditableCategoryKeys } from '../../../types/estimator/ratesFlags.ts'
import { CEILINGS_CATEGORY_CONFIGS } from './ceilingsCategory.ts'
import { DOORS_CATEGORY_CONFIGS } from './doorsCategory.ts'
import { DRYWALL_CATEGORY_CONFIGS } from './drywallCategory.ts'
import { OTHER_CATEGORY_CONFIGS } from './otherCategories.ts'
import { TRIM_CATEGORY_CONFIGS } from './trimCategory.ts'
import { WALLS_CATEGORY_CONFIGS } from './wallsCategory.ts'

const ALL_CATEGORY_CONFIGS: CategoryConfig[] = [
  ...WALLS_CATEGORY_CONFIGS,
  ...CEILINGS_CATEGORY_CONFIGS,
  ...TRIM_CATEGORY_CONFIGS,
  ...DOORS_CATEGORY_CONFIGS,
  ...DRYWALL_CATEGORY_CONFIGS,
  ...OTHER_CATEGORY_CONFIGS,
]

function findRequiredCategoryConfig<TKey extends RatesFlagsEditableCategoryKey>(
  key: TKey
): CategoryConfig<TKey> {
  const config = ALL_CATEGORY_CONFIGS.find((entry) => entry.key === key)
  if (!config) {
    throw new Error(`Missing rates/flags category config for ${key}`)
  }
  return config as CategoryConfig<TKey>
}

export const CATEGORY_CONFIGS_BY_KEY = Object.fromEntries(
  ratesFlagsEditableCategoryKeys.map((key) => [key, findRequiredCategoryConfig(key)] as const)
) as {
  [TKey in RatesFlagsEditableCategoryKey]: CategoryConfig<TKey>
}

export const CATEGORY_CONFIGS = ratesFlagsEditableCategoryKeys.map(
  (key) => CATEGORY_CONFIGS_BY_KEY[key]
)

export function getCategoryConfig<TKey extends RatesFlagsEditableCategoryKey>(key: TKey) {
  return CATEGORY_CONFIGS_BY_KEY[key] as CategoryConfig<TKey>
}

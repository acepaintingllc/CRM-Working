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

export const CATEGORY_CONFIGS_BY_KEY = {
  production_rates_walls: findRequiredCategoryConfig('production_rates_walls'),
  production_rates_ceilings: findRequiredCategoryConfig('production_rates_ceilings'),
  production_rates_trim: findRequiredCategoryConfig('production_rates_trim'),
  unit_rates_doors: findRequiredCategoryConfig('unit_rates_doors'),
  unit_rates_trim: findRequiredCategoryConfig('unit_rates_trim'),
  unit_rates_drywall: findRequiredCategoryConfig('unit_rates_drywall'),
  access_fees_ladders: findRequiredCategoryConfig('access_fees_ladders'),
  access_fees_scaffolding: findRequiredCategoryConfig('access_fees_scaffolding'),
  access_fees_specialty: findRequiredCategoryConfig('access_fees_specialty'),
  supply_rates_per_color: findRequiredCategoryConfig('supply_rates_per_color'),
  supply_rates_area_based: findRequiredCategoryConfig('supply_rates_area_based'),
  supply_rates_per_job: findRequiredCategoryConfig('supply_rates_per_job'),
  supply_rates_roller_covers: findRequiredCategoryConfig('supply_rates_roller_covers'),
  wall_complexity: findRequiredCategoryConfig('wall_complexity'),
  height_factors: findRequiredCategoryConfig('height_factors'),
  ceiling_types: findRequiredCategoryConfig('ceiling_types'),
  condition_modifiers: findRequiredCategoryConfig('condition_modifiers'),
  room_types: findRequiredCategoryConfig('room_types'),
  room_templates: findRequiredCategoryConfig('room_templates'),
  scope_defaults: findRequiredCategoryConfig('scope_defaults'),
} satisfies {
  [TKey in RatesFlagsEditableCategoryKey]: CategoryConfig<TKey>
}

export const CATEGORY_CONFIGS = ratesFlagsEditableCategoryKeys.map(
  (key) => CATEGORY_CONFIGS_BY_KEY[key]
)

export function getCategoryConfig<TKey extends RatesFlagsEditableCategoryKey>(key: TKey) {
  return CATEGORY_CONFIGS_BY_KEY[key] as CategoryConfig<TKey>
}

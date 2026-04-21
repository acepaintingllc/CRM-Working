import type { CategoryConfig } from './categoryTypes.ts'
import { CEILINGS_CATEGORY_CONFIGS } from './ceilingsCategory.ts'
import { DOORS_CATEGORY_CONFIGS } from './doorsCategory.ts'
import { DRYWALL_CATEGORY_CONFIGS } from './drywallCategory.ts'
import { OTHER_CATEGORY_CONFIGS } from './otherCategories.ts'
import { TRIM_CATEGORY_CONFIGS } from './trimCategory.ts'
import { WALLS_CATEGORY_CONFIGS } from './wallsCategory.ts'

export const CATEGORY_CONFIGS: CategoryConfig[] = [
  ...WALLS_CATEGORY_CONFIGS,
  ...CEILINGS_CATEGORY_CONFIGS,
  ...TRIM_CATEGORY_CONFIGS,
  ...DOORS_CATEGORY_CONFIGS,
  ...DRYWALL_CATEGORY_CONFIGS,
  ...OTHER_CATEGORY_CONFIGS,
]

export function getCategoryConfig(key: CategoryConfig['key']) {
  return CATEGORY_CONFIGS.find((config) => config.key === key) ?? null
}

import {
  ratesFlagsEditableCategoryRegistry,
  type RatesFlagsEditableCategoryKey,
  type RatesFlagsNavigationGroup,
} from '@/types/estimator/ratesFlags'

export type StatusFilter = 'active' | 'archived' | 'all'
export type RateSectionKey = Extract<
  RatesFlagsNavigationGroup,
  'production' | 'unit_rates' | 'access_fees' | 'supplies'
>
export type FlagsSectionKey = Extract<
  RatesFlagsNavigationGroup,
  'condition_modifiers' | 'height_factors' | 'wall_complexity' | 'ceiling_types'
>
export type RoomDefaultsSectionKey = Extract<
  RatesFlagsNavigationGroup,
  'room_types' | 'room_templates' | 'scope_defaults'
>

type CategoryNavigationItem = {
  key: RatesFlagsEditableCategoryKey
  label: string
}

export const RATE_SECTIONS = [
  { key: 'production', label: 'Production' },
  { key: 'unit_rates', label: 'Unit Rates' },
  { key: 'access_fees', label: 'Access Fees' },
  { key: 'supplies', label: 'Supplies' },
] as const

function buildNavigationItems(groups: readonly RatesFlagsNavigationGroup[]) {
  return ratesFlagsEditableCategoryRegistry
    .filter((category) => groups.includes(category.navigationGroup))
    .sort((left, right) => left.navigationOrder - right.navigationOrder)
    .map((category) => ({
      key: category.key,
      label: category.navigationLabel,
    }))
}

function buildRateSubgroups() {
  return Object.fromEntries(
    RATE_SECTIONS.map((section) => [
      section.key,
      buildNavigationItems([section.key]),
    ])
  ) as Record<RateSectionKey, CategoryNavigationItem[]>
}

export const RATE_SUBGROUPS: Record<
  RateSectionKey,
  CategoryNavigationItem[]
> = buildRateSubgroups()

export const FLAGS_SECTIONS = buildNavigationItems([
  'condition_modifiers',
  'height_factors',
  'wall_complexity',
  'ceiling_types',
]) as Array<CategoryNavigationItem & { key: FlagsSectionKey }>

export const ROOM_DEFAULTS_SECTIONS = buildNavigationItems([
  'room_types',
  'room_templates',
  'scope_defaults',
]) as Array<CategoryNavigationItem & { key: RoomDefaultsSectionKey }>

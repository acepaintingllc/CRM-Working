import type { RatesFlagsCategoryKey } from '@/types/estimator/ratesFlags'

export type StatusFilter = 'active' | 'archived' | 'all'
export type RateSectionKey = 'production' | 'unit_rates' | 'access_fees' | 'supplies'
export type FlagsSectionKey =
  | 'condition_modifiers'
  | 'height_factors'
  | 'wall_complexity'
  | 'ceiling_types'
export type RoomDefaultsSectionKey = 'room_types' | 'room_templates' | 'scope_defaults'

export const RATE_SECTIONS = [
  { key: 'production', label: 'Production' },
  { key: 'unit_rates', label: 'Unit Rates' },
  { key: 'access_fees', label: 'Access Fees' },
  { key: 'supplies', label: 'Supplies' },
] as const

export const RATE_SUBGROUPS: Record<
  RateSectionKey,
  Array<{
    key: RatesFlagsCategoryKey
    label: string
  }>
> = {
  production: [
    { key: 'production_rates_walls', label: 'Walls' },
    { key: 'production_rates_ceilings', label: 'Ceilings' },
    { key: 'production_rates_trim', label: 'Trim' },
  ],
  unit_rates: [
    { key: 'unit_rates_doors', label: 'Doors' },
    { key: 'unit_rates_trim', label: 'Trim Types' },
    { key: 'unit_rates_drywall', label: 'Drywall' },
  ],
  access_fees: [
    { key: 'access_fees_ladders', label: 'Ladders' },
    { key: 'access_fees_scaffolding', label: 'Scaffolding' },
    { key: 'access_fees_specialty', label: 'Specialty' },
  ],
  supplies: [
    { key: 'supply_rates_per_color', label: 'Per-Color' },
    { key: 'supply_rates_area_based', label: 'Area-Based' },
    { key: 'supply_rates_per_job', label: 'Per-Job' },
    { key: 'supply_rates_roller_covers', label: 'Roller Covers' },
  ],
}

export const FLAGS_SECTIONS = [
  { key: 'condition_modifiers', label: 'Condition Modifiers' },
  { key: 'height_factors', label: 'Height Factors' },
  { key: 'wall_complexity', label: 'Wall Complexity' },
  { key: 'ceiling_types', label: 'Ceiling Types' },
] as const

export const ROOM_DEFAULTS_SECTIONS = [
  { key: 'room_types', label: 'Room Types' },
  { key: 'room_templates', label: 'Room Templates' },
  { key: 'scope_defaults', label: 'Scope Defaults' },
] as const

export const ESTIMATE_VERSION_STATES = ['draft', 'live', 'archived'] as const
export const ESTIMATE_VERSION_KINDS = [
  'standard',
  'alternate',
  'split',
  'combined',
  'revision',
] as const

export const WALL_SCOPE_MODES = ['RECT', 'SEG'] as const
export const WALL_PRIME_MODES = ['NONE', 'SPOT', 'FULL'] as const
export const WALL_SEGMENT_SHAPES = ['RECTANGLE', 'TRIANGLE', 'MANUAL'] as const

export const MATERIAL_TYPES = ['PAINT', 'PRIMER'] as const
export const MATERIAL_SOURCE_TYPES = ['WALL_SCOPE', 'WALL_SEGMENT', 'MANUAL'] as const
export const PURCHASE_ALLOCATION_METHODS = ['RAW_QUANTITY', 'AREA', 'MANUAL'] as const

export const SUPPLY_REQUIREMENT_KINDS = ['PER_COLOR', 'AREA_BASED', 'MANUAL'] as const
export const SUPPLY_SOURCE_TYPES = ['WALL_SCOPE', 'WALL_SEGMENT', 'ESTIMATE_VERSION'] as const
export const SUPPLY_ALLOCATION_METHODS = ['DIRECT', 'RAW_GALLONS', 'AREA', 'MANUAL'] as const

export type * from '@/types/estimator'

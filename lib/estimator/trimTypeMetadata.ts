import type {
  EstimateV2TrimCategory,
  EstimateV2TrimMeasurementClass,
} from '../../types/estimator/v2.ts'

const TRIM_CATEGORIES: EstimateV2TrimCategory[] = [
  'base',
  'crown',
  'casing',
  'rail',
  'door_window',
  'panel',
  'feature',
  'other',
]

const MEASUREMENT_CLASSES: EstimateV2TrimMeasurementClass[] = [
  'linear',
  'opening',
  'surface',
  'assembly',
]

const PICKER_GROUP_BY_CATEGORY: Record<EstimateV2TrimCategory, string> = {
  base: 'Base',
  crown: 'Crown',
  casing: 'Casing',
  rail: 'Rails',
  door_window: 'Doors/Windows',
  panel: 'Panels',
  feature: 'Features',
  other: 'Other',
}

export type TrimTypeMetadataInput = {
  id?: string | null
  label?: string | null
  family?: string | null
  category?: string | null
  unitType?: string | null
  trimCategory?: string | null
  measurementClass?: string | null
  pickerGroup?: string | null
}

export type TrimTypeMetadata = {
  trim_category: EstimateV2TrimCategory
  measurement_class: EstimateV2TrimMeasurementClass
  picker_group: string
}

function clean(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function lower(value: unknown) {
  return clean(value).toLowerCase()
}

function validCategory(value: unknown): EstimateV2TrimCategory | null {
  const raw = lower(value)
  return TRIM_CATEGORIES.includes(raw as EstimateV2TrimCategory)
    ? (raw as EstimateV2TrimCategory)
    : null
}

function validMeasurementClass(value: unknown): EstimateV2TrimMeasurementClass | null {
  const raw = lower(value)
  return MEASUREMENT_CLASSES.includes(raw as EstimateV2TrimMeasurementClass)
    ? (raw as EstimateV2TrimMeasurementClass)
    : null
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term))
}

function hasBaseTrimTerm(text: string) {
  const spaced = text.replace(/[_-]+/g, ' ')
  return (
    includesAny(spaced, ['baseboard', 'base board', 'base molding', 'shoe', 'quarter round']) ||
    spaced.split(/\s+/).includes('base')
  )
}

function inferCategory(input: TrimTypeMetadataInput): EstimateV2TrimCategory {
  const text = [
    input.id,
    input.label,
    input.family,
    input.category,
    input.pickerGroup,
  ]
    .map(lower)
    .join(' ')

  if (hasBaseTrimTerm(text)) {
    return 'base'
  }
  if (text.includes('crown')) return 'crown'
  if (text.includes('casing')) return 'casing'
  if (text.includes('rail')) return 'rail'
  if (includesAny(text, ['door', 'window'])) return 'door_window'
  if (includesAny(text, ['panel', 'wainscot'])) return 'panel'
  if (includesAny(text, ['fireplace', 'built-in', 'builtin', 'cabinet', 'beam', 'mantel'])) {
    return 'feature'
  }
  return 'other'
}

function inferMeasurementClass(
  category: EstimateV2TrimCategory,
  unitType: string
): EstimateV2TrimMeasurementClass {
  const unit = unitType.toUpperCase()
  if (category === 'feature') return unit === 'SF' ? 'surface' : 'assembly'
  if (category === 'panel') {
    if (unit === 'SF') return 'surface'
    if (unit === 'EA') return 'assembly'
    return 'linear'
  }
  if (category === 'door_window') return unit === 'EA' ? 'opening' : 'linear'
  if (category === 'base' || category === 'crown' || category === 'casing' || category === 'rail') {
    return 'linear'
  }
  if (unit === 'EA') return 'assembly'
  if (unit === 'SF') return 'surface'
  return 'linear'
}

export function inferTrimTypeMetadata(input: TrimTypeMetadataInput): TrimTypeMetadata {
  const trimCategory = validCategory(input.trimCategory) ?? inferCategory(input)
  const measurementClass =
    validMeasurementClass(input.measurementClass) ??
    inferMeasurementClass(trimCategory, clean(input.unitType))
  const pickerGroup = clean(input.pickerGroup) || PICKER_GROUP_BY_CATEGORY[trimCategory]

  return {
    trim_category: trimCategory,
    measurement_class: measurementClass,
    picker_group: pickerGroup,
  }
}

export function isBaseTrimType(input: TrimTypeMetadataInput) {
  return inferTrimTypeMetadata(input).trim_category === 'base'
}

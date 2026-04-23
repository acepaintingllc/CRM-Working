import type {
  CeilingTypeDraft,
  ConditionModifierDraft,
  HeightFactorDraft,
  RatesFlagsCategoryValueMap,
  RatesFlagsDraftByCategory,
  WallComplexityDraft,
} from '../../../types/estimator/ratesFlags'
import { buildAdapter } from './buildAdapter.ts'
import { asDraftNumberString, asDraftString } from './shared.ts'

function buildMultiplierValues<TKey extends 'wall_complexity' | 'height_factors' | 'ceiling_types' | 'condition_modifiers'>(
  categoryKey: TKey,
  draft:
    | RatesFlagsDraftByCategory[TKey]
    | HeightFactorDraft
    | WallComplexityDraft
    | CeilingTypeDraft
    | ConditionModifierDraft,
  draftActive: boolean
) {
  if (categoryKey === 'condition_modifiers') {
    const conditionDraft = draft as ConditionModifierDraft
    return {
      id: asDraftString(conditionDraft.id),
      display_name: asDraftString(conditionDraft.display_name),
      wall_factor: asDraftNumberString(conditionDraft.wall_factor),
      ceil_factor: asDraftNumberString(conditionDraft.ceil_factor),
      trim_factor: asDraftNumberString(conditionDraft.trim_factor),
      notes: asDraftString(conditionDraft.notes),
      active: draftActive ? 'Y' : 'N',
    } as RatesFlagsCategoryValueMap[TKey]
  }

  if (categoryKey === 'height_factors') {
    const heightDraft = draft as HeightFactorDraft
    return {
      id: asDraftString(heightDraft.id),
      display_name: asDraftString(heightDraft.display_name),
      min_height_ft: asDraftNumberString(heightDraft.min_height_ft),
      max_height_ft: asDraftNumberString(heightDraft.max_height_ft),
      primary_value: asDraftNumberString(heightDraft.primary_value),
      notes: asDraftString(heightDraft.notes),
      active: draftActive ? 'Y' : 'N',
    } as RatesFlagsCategoryValueMap[TKey]
  }

  const multiplierDraft = draft as WallComplexityDraft | CeilingTypeDraft
  return {
    id: asDraftString(multiplierDraft.id),
    display_name: asDraftString(multiplierDraft.display_name),
    primary_value: asDraftNumberString(multiplierDraft.primary_value),
    secondary_value: asDraftNumberString(multiplierDraft.secondary_value),
    notes: asDraftString(multiplierDraft.notes),
    active: draftActive ? 'Y' : 'N',
  } as RatesFlagsCategoryValueMap[TKey]
}

export const multipliersDraftAdapters = {
  wall_complexity: buildAdapter({
    key: 'wall_complexity',
    toValues: (draft: WallComplexityDraft, draftActive) =>
      buildMultiplierValues('wall_complexity', draft, draftActive),
  }),
  height_factors: buildAdapter({
    key: 'height_factors',
    toValues: (draft: HeightFactorDraft, draftActive) =>
      buildMultiplierValues('height_factors', draft, draftActive),
  }),
  ceiling_types: buildAdapter({
    key: 'ceiling_types',
    toValues: (draft: CeilingTypeDraft, draftActive) =>
      buildMultiplierValues('ceiling_types', draft, draftActive),
  }),
  condition_modifiers: buildAdapter({
    key: 'condition_modifiers',
    toValues: (draft: ConditionModifierDraft, draftActive) =>
      buildMultiplierValues('condition_modifiers', draft, draftActive),
  }),
}

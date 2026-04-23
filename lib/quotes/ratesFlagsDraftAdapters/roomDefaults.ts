import type {
  RatesFlagsCategoryValueMap,
  RoomTemplateDraft,
  RoomTypeDraft,
  ScopeDefaultDraft,
} from '../../../types/estimator/ratesFlags'
import { buildAdapter } from './buildAdapter.ts'
import { asDraftNumberString, asDraftString, asDraftYN } from './shared.ts'

function buildRoomDefaultsValues<TKey extends 'room_types' | 'room_templates' | 'scope_defaults'>(
  categoryKey: TKey,
  draft: RoomTypeDraft | RoomTemplateDraft | ScopeDefaultDraft,
  draftActive: boolean
) {
  if (categoryKey === 'room_templates') {
    const templateDraft = draft as RoomTemplateDraft
    return {
      id: asDraftString(templateDraft.id),
      display_name: asDraftString(templateDraft.display_name),
      room_type_id: asDraftString(templateDraft.room_type_id),
      default_wall_rate_id: asDraftString(templateDraft.default_wall_rate_id),
      default_ceil_rate_id: asDraftString(templateDraft.default_ceil_rate_id),
      default_complexity_id: asDraftString(templateDraft.default_complexity_id),
      default_wall_mode: asDraftString(templateDraft.default_wall_mode),
      include_walls: asDraftYN(templateDraft.include_walls),
      include_ceilings: asDraftYN(templateDraft.include_ceilings),
      include_trim: asDraftYN(templateDraft.include_trim),
      include_doors: asDraftYN(templateDraft.include_doors),
      include_drywall: asDraftYN(templateDraft.include_drywall),
      notes: asDraftString(templateDraft.notes),
      active: draftActive ? 'Y' : 'N',
    } as RatesFlagsCategoryValueMap[TKey]
  }

  if (categoryKey === 'scope_defaults') {
    const scopeDraft = draft as ScopeDefaultDraft
    return {
      id: asDraftString(scopeDraft.id),
      display_name: asDraftString(scopeDraft.display_name),
      default_wall_mode: asDraftString(scopeDraft.default_wall_mode),
      top_cut_in_factor: asDraftNumberString(scopeDraft.top_cut_in_factor),
      bot_cut_in_factor: asDraftNumberString(scopeDraft.bot_cut_in_factor),
      typical_height_ft: asDraftNumberString(scopeDraft.typical_height_ft),
      include_walls: asDraftYN(scopeDraft.include_walls),
      include_ceilings: asDraftYN(scopeDraft.include_ceilings),
      include_trim: asDraftYN(scopeDraft.include_trim),
      include_doors: asDraftYN(scopeDraft.include_doors),
      include_drywall: asDraftYN(scopeDraft.include_drywall),
      notes: asDraftString(scopeDraft.notes),
      active: draftActive ? 'Y' : 'N',
    } as RatesFlagsCategoryValueMap[TKey]
  }

  const roomTypeDraft = draft as RoomTypeDraft
  return {
    id: asDraftString(roomTypeDraft.id),
    display_name: asDraftString(roomTypeDraft.display_name),
    default_wall_rate_id: asDraftString(roomTypeDraft.default_wall_rate_id),
    default_ceil_rate_id: asDraftString(roomTypeDraft.default_ceil_rate_id),
    default_complexity_id: asDraftString(roomTypeDraft.default_complexity_id),
    default_wall_mode: asDraftString(roomTypeDraft.default_wall_mode),
    top_cut_in_factor: asDraftNumberString(roomTypeDraft.top_cut_in_factor),
    bot_cut_in_factor: asDraftNumberString(roomTypeDraft.bot_cut_in_factor),
    typical_height_ft: asDraftNumberString(roomTypeDraft.typical_height_ft),
    notes: asDraftString(roomTypeDraft.notes),
    active: draftActive ? 'Y' : 'N',
  } as RatesFlagsCategoryValueMap[TKey]
}

export const roomDefaultsDraftAdapters = {
  room_types: buildAdapter({
    key: 'room_types',
    toValues: (draft: RoomTypeDraft, draftActive) =>
      buildRoomDefaultsValues('room_types', draft, draftActive),
  }),
  room_templates: buildAdapter({
    key: 'room_templates',
    toValues: (draft: RoomTemplateDraft, draftActive) =>
      buildRoomDefaultsValues('room_templates', draft, draftActive),
  }),
  scope_defaults: buildAdapter({
    key: 'scope_defaults',
    toValues: (draft: ScopeDefaultDraft, draftActive) =>
      buildRoomDefaultsValues('scope_defaults', draft, draftActive),
  }),
}

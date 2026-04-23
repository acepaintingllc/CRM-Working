import type {
  AccessFeeDraft,
  RatesFlagsCategoryValueMap,
  RatesFlagsDraftByCategory,
} from '../../../types/estimator/ratesFlags'
import { buildAdapter } from './buildAdapter.ts'
import { asDraftNumberString, asDraftString } from './shared.ts'

function buildAccessFeeValues<TKey extends 'access_fees_ladders' | 'access_fees_scaffolding' | 'access_fees_specialty'>(
  categoryKey: TKey,
  draft: RatesFlagsDraftByCategory[TKey] | AccessFeeDraft,
  draftActive: boolean
) {
  return {
    access_group:
      categoryKey === 'access_fees_ladders'
        ? 'ladders'
        : categoryKey === 'access_fees_scaffolding'
          ? 'scaffolding'
          : 'specialty',
    id: asDraftString(draft.id),
    display_name: asDraftString(draft.display_name),
    fee_type: asDraftString(draft.fee_type),
    amount: asDraftNumberString(draft.amount),
    unit: asDraftString(draft.unit),
    notes: asDraftString(draft.notes),
    active: draftActive ? 'Y' : 'N',
  } as RatesFlagsCategoryValueMap[TKey]
}

export const accessFeesDraftAdapters = {
  access_fees_ladders: buildAdapter({
    key: 'access_fees_ladders',
    toValues: (draft: AccessFeeDraft, draftActive) =>
      buildAccessFeeValues('access_fees_ladders', draft, draftActive),
  }),
  access_fees_scaffolding: buildAdapter({
    key: 'access_fees_scaffolding',
    toValues: (draft: AccessFeeDraft, draftActive) =>
      buildAccessFeeValues('access_fees_scaffolding', draft, draftActive),
  }),
  access_fees_specialty: buildAdapter({
    key: 'access_fees_specialty',
    toValues: (draft: AccessFeeDraft, draftActive) =>
      buildAccessFeeValues('access_fees_specialty', draft, draftActive),
  }),
}

import type {
  RatesFlagsCategoryValueMap,
  RatesFlagsDraft,
  RatesFlagsEditableCategoryKey,
} from '../../../types/estimator/ratesFlags'
import {
  createEmptyTypedDraft,
  formatTypedDraftValue,
  rowToTypedDraft,
  updateTypedDraftField,
  validateTypedDraft,
  withDuplicateId,
} from './shared.ts'
import type { RatesFlagsDraftAdapter } from './types.ts'

export function buildAdapter<TKey extends RatesFlagsEditableCategoryKey, TDraft extends RatesFlagsDraft<TKey>>(config: {
  key: TKey
  toValues: (draft: TDraft, draftActive: boolean) => RatesFlagsCategoryValueMap[TKey]
}): RatesFlagsDraftAdapter<TKey, TDraft> {
  return {
    key: config.key,
    createEmptyDraft(category) {
      return createEmptyTypedDraft<TDraft>(category)
    },
    rowToDraft(category, row) {
      return rowToTypedDraft<TDraft>(category, row)
    },
    updateDraftField(category, currentDraft, fieldKey, rawInput) {
      return updateTypedDraftField(category, currentDraft, fieldKey, rawInput)
    },
    validateDraft(category, draft) {
      return validateTypedDraft(category, draft)
    },
    toMutationRequest({ action, draft, draftActive, originalId }) {
      if (action === 'create') {
        return {
          category: config.key,
          action: 'create',
          values: config.toValues(draft, draftActive),
        }
      }

      return {
        category: config.key,
        action: 'update',
        original_id: originalId ?? String(draft.id ?? ''),
        values: config.toValues(draft, draftActive),
      }
    },
    toArchiveRequest({ action, rowId }) {
      return {
        category: config.key,
        action,
        rowId,
      }
    },
    formatDraftValue(category, draft, fieldKey) {
      return formatTypedDraftValue(category, draft, fieldKey)
    },
    withDuplicateId(draft, rowId) {
      return withDuplicateId(draft, rowId)
    },
  }
}

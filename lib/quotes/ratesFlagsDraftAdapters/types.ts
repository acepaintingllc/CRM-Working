import type {
  RatesFlagsActivationRequest,
  RatesFlagsCategory,
  RatesFlagsCreateOrUpdateRequest,
  RatesFlagsDraft,
  RatesFlagsDraftValidationResult,
  RatesFlagsEditableCategoryKey,
  RatesFlagsRow,
} from '../../../types/estimator/ratesFlags'

export type RatesFlagsArchiveAction = 'archive' | 'reactivate'
export type RatesFlagsCreateOrUpdateAction = 'create' | 'update'
export type DraftValue = string | number | boolean | null

export type RatesFlagsDraftAdapter<
  TKey extends RatesFlagsEditableCategoryKey,
  TDraft extends RatesFlagsDraft<TKey> = RatesFlagsDraft<TKey>,
> = {
  key: TKey
  createEmptyDraft: (category: RatesFlagsCategory) => TDraft
  rowToDraft: (category: RatesFlagsCategory, row: RatesFlagsRow) => TDraft
  updateDraftField: (
    category: RatesFlagsCategory,
    currentDraft: TDraft,
    fieldKey: string,
    rawInput: string
  ) => TDraft
  validateDraft: (category: RatesFlagsCategory, draft: TDraft) => RatesFlagsDraftValidationResult
  toMutationRequest: (params: {
    action: RatesFlagsCreateOrUpdateAction
    draft: TDraft
    draftActive: boolean
    originalId?: string
  }) => RatesFlagsCreateOrUpdateRequest<TKey>
  toArchiveRequest: (params: {
    action: RatesFlagsArchiveAction
    rowId: string
  }) => RatesFlagsActivationRequest<TKey>
  formatDraftValue: (category: RatesFlagsCategory, draft: TDraft, fieldKey: string) => string
  withDuplicateId: (draft: TDraft, rowId: string) => TDraft
}

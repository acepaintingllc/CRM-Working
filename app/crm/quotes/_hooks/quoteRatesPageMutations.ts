'use client'

import { mutateRatesFlags } from '@/lib/quotes/client'
import { getRatesFlagsDraftAdapter } from '@/lib/quotes/ratesFlagsDraftAdapters'
import type {
  RatesFlagsActivationMutationRequest,
  RatesFlagsCreateOrUpdateMutation,
  RatesFlagsEditableCategory,
  RatesFlagsEditableCategoryKey,
} from '@/types/estimator/ratesFlags'
import { findReconciledRatesRow, reconcileRatesFlagsPayload } from './quoteRatesMutationReconciliation'
import { buildQuoteRatesMutationSnapshot } from './quoteRatesPageNavigation'
import type {
  QuoteRatesActionStatus,
  QuoteRatesEditorMode,
  QuoteRatesNavigationState,
} from './quoteRatesPageState'
import type { QuoteRatesDataResource } from './useQuoteRatesData'

type MutationErrorResult = {
  ok: false
  error: string
}

type MutationSuccessResult = {
  ok: true
  notice: string
  tone: 'success' | 'warning'
  selectedId: string
  editor: ReturnType<typeof buildQuoteRatesMutationSnapshot>['editor']
}

type MutationResult = MutationErrorResult | MutationSuccessResult

type PersistParams = {
  request: RatesFlagsCreateOrUpdateMutation | RatesFlagsActivationMutationRequest
  resource: QuoteRatesDataResource
}

async function persistRatesFlagsMutation(params: PersistParams) {
  const { request, resource } = params

  await mutateRatesFlags(request as never)

  const verification = await resource.attemptRefresh({
    preserveDataOnError: true,
    reportError: false,
  })
  const nextPayload =
    (verification.ok && verification.data) ||
    reconcileRatesFlagsPayload(resource.data, request)
  if (!verification.ok) {
    resource.setData(nextPayload)
  }

  return {
    nextPayload,
    verification,
  }
}

export async function saveQuoteRatesMutation(params: {
  resource: QuoteRatesDataResource
  navigation: QuoteRatesNavigationState
  activeCategory: RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey>
  draft: NonNullable<ReturnType<typeof buildQuoteRatesMutationSnapshot>['editor']['draft']>
  draftActive: boolean
  editorMode: QuoteRatesEditorMode
  selectedRowId?: string
}): Promise<MutationResult> {
  const { resource, navigation, activeCategory, draft, draftActive, editorMode, selectedRowId } = params

  try {
    const adapter = getRatesFlagsDraftAdapter(activeCategory.key as RatesFlagsEditableCategoryKey)
    const request = adapter.toMutationRequest({
      action: editorMode === 'create' ? 'create' : 'update',
      draft: draft as never,
      draftActive,
      originalId: editorMode === 'create' ? undefined : selectedRowId,
    }) as RatesFlagsCreateOrUpdateMutation
    const keepId = typeof draft.id === 'string' && draft.id ? draft.id : selectedRowId ?? ''
    const { nextPayload, verification } = await persistRatesFlagsMutation({ request, resource })
    const mutationSnapshot = buildQuoteRatesMutationSnapshot(nextPayload, navigation, keepId)
    const verb = editorMode === 'create' ? 'Created' : 'Saved'

    return {
      ok: true,
      selectedId: mutationSnapshot.selectedId,
      editor: mutationSnapshot.editor,
      notice: verification.ok
        ? `${verb} ${activeCategory.label}.`
        : `${verb} ${activeCategory.label}, but refresh failed. Showing locally updated data.${verification.error ? ` ${verification.error}` : ''}`,
      tone: verification.ok ? 'success' : 'warning',
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to save changes.',
    }
  }
}

export async function archiveOrReactivateQuoteRatesMutation(params: {
  resource: QuoteRatesDataResource
  navigation: QuoteRatesNavigationState
  categoryKey: RatesFlagsEditableCategoryKey
  selectedRowId: string
  nextActive: boolean
}): Promise<MutationResult> {
  const { resource, navigation, categoryKey, selectedRowId, nextActive } = params

  try {
    const request: RatesFlagsActivationMutationRequest = {
      category: categoryKey,
      action: nextActive ? 'reactivate' : 'archive',
      rowId: selectedRowId,
    } as RatesFlagsActivationMutationRequest
    const { nextPayload, verification } = await persistRatesFlagsMutation({ request, resource })
    const preferredRow =
      findReconciledRatesRow(nextPayload, request.category, selectedRowId)?.id ?? selectedRowId
    const mutationSnapshot = buildQuoteRatesMutationSnapshot(nextPayload, navigation, preferredRow)

    return {
      ok: true,
      selectedId: mutationSnapshot.selectedId,
      editor: mutationSnapshot.editor,
      notice: verification.ok
        ? nextActive
          ? 'Reactivated row.'
          : 'Archived row.'
        : `${nextActive ? 'Reactivated' : 'Archived'} row, but refresh failed. Showing locally updated data.${verification.error ? ` ${verification.error}` : ''}`,
      tone: verification.ok ? 'success' : 'warning',
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to save changes.',
    }
  }
}

export type QuoteRatesMutationRequestStatus = Extract<
  QuoteRatesActionStatus,
  'saving' | 'archiving'
>

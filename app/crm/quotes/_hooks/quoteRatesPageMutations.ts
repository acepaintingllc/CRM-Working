'use client'

import { activateRatesFlagsDraft, mutateRatesFlags } from '@/lib/quotes/client'
import { getRatesFlagsDraftAdapter } from '@/lib/quotes/ratesFlagsDraftAdapters'
import type {
  RatesFlagsEditableCategory,
  RatesFlagsEditableCategoryKey,
  RatesFlagsMutationRequestByCategory,
} from '@/types/estimator/ratesFlags'
import {
  decideRatesFlagsMutationReconciliation,
  findReconciledRatesRow,
  type RatesFlagsMutationReconciliation,
} from './quoteRatesMutationReconciliation'
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
  reconciliation: RatesFlagsMutationReconciliation
}

type MutationResult = MutationErrorResult | MutationSuccessResult

type SaveQuoteRatesDraft = Parameters<
  ReturnType<typeof getRatesFlagsDraftAdapter<RatesFlagsEditableCategoryKey>>['toMutationRequest']
>[0]['draft']

type PersistParams = {
  request: RatesFlagsMutationRequestByCategory<RatesFlagsEditableCategoryKey>
  resource: QuoteRatesDataResource
}

async function persistRatesFlagsMutation(params: PersistParams) {
  const { request, resource } = params

  await mutateRatesFlags(request)

  const verification = await resource.attemptRefresh({
    preserveDataOnError: true,
    reportError: false,
  })
  const reconciliation = decideRatesFlagsMutationReconciliation({
    currentPayload: resource.data,
    request,
    verification: verification.ok && verification.data
      ? { ok: true, data: verification.data, error: null }
      : { ok: false, data: verification.data, error: verification.error },
  })

  if (reconciliation.kind === 'local_fallback') {
    resource.setData(reconciliation.payload)
  }

  return {
    nextPayload: reconciliation.payload,
    verification,
    reconciliation,
  }
}

export async function saveQuoteRatesMutation(params: {
  resource: QuoteRatesDataResource
  navigation: QuoteRatesNavigationState
  activeCategory: RatesFlagsEditableCategory<RatesFlagsEditableCategoryKey>
  draft: SaveQuoteRatesDraft
  draftActive: boolean
  editorMode: QuoteRatesEditorMode
  selectedRowId?: string
}): Promise<MutationResult> {
  const { resource, navigation, activeCategory, draft, draftActive, editorMode, selectedRowId } = params

  try {
    const adapter = getRatesFlagsDraftAdapter(activeCategory.key)
    const request = adapter.toMutationRequest({
      action: editorMode === 'create' ? 'create' : 'update',
      category: activeCategory,
      draft,
      draftActive,
      originalId: editorMode === 'create' ? undefined : selectedRowId,
    })
    const keepId = typeof draft.id === 'string' && draft.id ? draft.id : selectedRowId ?? ''
    const { nextPayload, reconciliation } = await persistRatesFlagsMutation({ request, resource })
    const mutationSnapshot = buildQuoteRatesMutationSnapshot(nextPayload, navigation, keepId)
    const verb = editorMode === 'create' ? 'Created' : 'Saved'

    return {
      ok: true,
      selectedId: mutationSnapshot.selectedId,
      editor: mutationSnapshot.editor,
      reconciliation,
      notice: reconciliation.kind === 'server_verified'
        ? `${verb} ${activeCategory.label}.`
        : `${verb} ${activeCategory.label}, but refresh failed. Showing locally updated data.${reconciliation.verificationError ? ` ${reconciliation.verificationError}` : ''}`,
      tone: reconciliation.kind === 'server_verified' ? 'success' : 'warning',
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
    const adapter = getRatesFlagsDraftAdapter(categoryKey)
    const request: RatesFlagsMutationRequestByCategory<RatesFlagsEditableCategoryKey> =
      adapter.toArchiveRequest({
        action: nextActive ? 'reactivate' : 'archive',
        rowId: selectedRowId,
      })
    const { nextPayload, reconciliation } = await persistRatesFlagsMutation({ request, resource })
    const preferredRow =
      findReconciledRatesRow(nextPayload, request.category, selectedRowId)?.id ?? selectedRowId
    const mutationSnapshot = buildQuoteRatesMutationSnapshot(nextPayload, navigation, preferredRow)

    return {
      ok: true,
      selectedId: mutationSnapshot.selectedId,
      editor: mutationSnapshot.editor,
      reconciliation,
      notice: reconciliation.kind === 'server_verified'
        ? nextActive
          ? 'Reactivated row.'
          : 'Archived row.'
        : `${nextActive ? 'Reactivated' : 'Archived'} row, but refresh failed. Showing locally updated data.${reconciliation.verificationError ? ` ${reconciliation.verificationError}` : ''}`,
      tone: reconciliation.kind === 'server_verified' ? 'success' : 'warning',
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to save changes.',
    }
  }
}

export async function activateQuoteRatesDraftMutation(params: {
  resource: QuoteRatesDataResource
  navigation: QuoteRatesNavigationState
  selectedRowId: string
}): Promise<MutationResult> {
  const { resource, navigation, selectedRowId } = params
  const draftId = resource.data.draft_setting_set?.id ?? null

  try {
    await activateRatesFlagsDraft({ setting_set_id: draftId })

    const verification = await resource.attemptRefresh({
      preserveDataOnError: true,
      reportError: false,
    })
    if (!verification.ok || !verification.data) {
      const mutationSnapshot = buildQuoteRatesMutationSnapshot(
        resource.data,
        navigation,
        selectedRowId
      )
      return {
        ok: true,
        notice: `Activated draft, but refresh failed.${verification.error ? ` ${verification.error}` : ''}`,
        tone: 'warning',
        selectedId: mutationSnapshot.selectedId,
        editor: mutationSnapshot.editor,
        reconciliation: {
          kind: 'local_fallback',
          payload: resource.data,
          verificationError: verification.error,
        },
      }
    }

    const mutationSnapshot = buildQuoteRatesMutationSnapshot(
      verification.data,
      navigation,
      selectedRowId
    )
    return {
      ok: true,
      notice: 'Activated rates and flags draft.',
      tone: 'success',
      selectedId: mutationSnapshot.selectedId,
      editor: mutationSnapshot.editor,
      reconciliation: {
        kind: 'server_verified',
        payload: verification.data,
        verificationError: null,
      },
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to activate draft.',
    }
  }
}

export type QuoteRatesMutationRequestStatus = Extract<
  QuoteRatesActionStatus,
  'saving' | 'archiving' | 'activating'
>

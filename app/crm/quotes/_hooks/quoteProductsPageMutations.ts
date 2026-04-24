'use client'

import {
  archiveQuoteProduct,
  createQuoteProduct,
  updateQuoteProduct,
} from '@/lib/quotes/client'
import type { QuoteProductPayload, QuoteProductRow } from '@/lib/quotes/productsForm'
import {
  buildArchivedQuoteProductResourcePatch,
  buildCreatedQuoteProductResourcePatch,
  buildUpdatedQuoteProductResourcePatch,
} from './quoteProductsControllerUtils'
import type { QuoteProductsWorkflowState } from './quoteProductsPageState'
import type { QuoteProductsResourceAdapter } from './useQuoteProductsData'

type QuoteProductsMutationErrorResult = {
  ok: false
  error: string
}

type QuoteProductsSaveSuccessResult = {
  ok: true
  row: QuoteProductRow
  notice: string
  navigation: QuoteProductsWorkflowState['navigation']
}

type QuoteProductsArchiveSuccessResult = {
  ok: true
  deletedId: string
  notice: string
  nextSelectedId: string | null
}

type QuoteProductsResourcePatch = {
  visibleRows: QuoteProductRow[]
  knownRows: QuoteProductRow[]
}

function applyQuoteProductsResourcePatch(
  resource: QuoteProductsResourceAdapter,
  patch: QuoteProductsResourcePatch
) {
  resource.setData(() => patch.visibleRows)
  resource.setAllKnownData(() => patch.knownRows)
}

export async function saveQuoteProductsMutation(params: {
  resource: QuoteProductsResourceAdapter
  state: QuoteProductsWorkflowState
  payload: QuoteProductPayload
}): Promise<QuoteProductsSaveSuccessResult | QuoteProductsMutationErrorResult> {
  const { resource, state, payload } = params

  try {
    if (state.editorMode === 'create') {
      const created = await createQuoteProduct<QuoteProductRow>(payload)
      const patch = buildCreatedQuoteProductResourcePatch({
        knownRows: resource.allKnownData,
        createdRow: created.data,
        navigation: state.navigation,
      })

      applyQuoteProductsResourcePatch(resource, patch)
      return {
        ok: true,
        row: created.data,
        notice: created.notice ?? 'Product created.',
        navigation: patch.navigation,
      }
    }

    const selectedId = state.selectedId
    if (!selectedId) {
      return {
        ok: false,
        error: 'Failed to save product.',
      }
    }

    const updated = await updateQuoteProduct<QuoteProductRow>(selectedId, payload)
    const patch = buildUpdatedQuoteProductResourcePatch({
      visibleRows: resource.data,
      knownRows: resource.allKnownData,
      updatedRow: updated.data,
      navigation: state.navigation,
      previousId: selectedId,
    })

    applyQuoteProductsResourcePatch(resource, patch)
    return {
      ok: true,
      row: updated.data,
      notice: updated.notice ?? 'Product saved.',
      navigation: state.navigation,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to save product.',
    }
  }
}

export async function archiveQuoteProductsMutation(params: {
  resource: QuoteProductsResourceAdapter
  state: QuoteProductsWorkflowState
  deleteTargetId: string
}): Promise<QuoteProductsArchiveSuccessResult | QuoteProductsMutationErrorResult> {
  const { resource, state, deleteTargetId } = params

  try {
    const archived = await archiveQuoteProduct<QuoteProductRow>(deleteTargetId)
    const patch = buildArchivedQuoteProductResourcePatch({
      visibleRows: resource.data,
      knownRows: resource.allKnownData,
      archivedRow: archived.data,
      navigation: state.navigation,
      archivedId: deleteTargetId,
    })
    const nextSelectedId =
      state.selectedId === deleteTargetId ? deleteTargetId : state.selectedId

    applyQuoteProductsResourcePatch(resource, patch)
    return {
      ok: true,
      deletedId: deleteTargetId,
      notice: 'Product archived.',
      nextSelectedId,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to archive product.',
    }
  }
}

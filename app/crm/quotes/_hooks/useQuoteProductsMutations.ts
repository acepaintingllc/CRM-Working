'use client'

import { useState } from 'react'
import { deleteQuoteProduct, createQuoteProduct, updateQuoteProduct } from '@/lib/quotes/client'
import type {
  ProductFamily,
  QuoteProductQuery,
  QuoteProductRow,
} from '@/lib/quotes/productsForm'
import { removeProductFromVisibleSlice, upsertProductIntoVisibleSlice } from './quoteProductsControllerUtils'
import type { useDenseQuoteAdminFeedback } from './useDenseQuoteAdminFeedback'
import type { useQuoteProductEditorState } from './useQuoteProductEditorState'

type Resource = {
  setData: (updater: (current: QuoteProductRow[]) => QuoteProductRow[]) => void
}

type SelectionState = {
  selectedId: string | null
  editorSelected: QuoteProductRow | null
  setSelectedIdState: (value: string | null) => void
  setEditorSelected: (value: QuoteProductRow | null) => void
}

type QueryState = {
  activeFamily: ProductFamily
  query: QuoteProductQuery
  resetVisibleFilters: (nextFamily: ProductFamily) => void
  setActiveFamilyState: (value: ProductFamily) => void
}

type Options = {
  resource: Resource
  feedback: ReturnType<typeof useDenseQuoteAdminFeedback>
  editor: ReturnType<typeof useQuoteProductEditorState>
  selection: SelectionState
  queryState: QueryState
}

export function useQuoteProductsMutations({
  resource,
  feedback,
  editor,
  selection,
  queryState,
}: Options) {
  const { selectedId, editorSelected, setSelectedIdState, setEditorSelected } = selection
  const [deleteTarget, setDeleteTarget] = useState<QuoteProductRow | null>(null)

  function clearDeleteDialog() {
    setDeleteTarget(null)
  }

  async function save() {
    const validated = editor.getValidatedDraft()
    if (!validated.ok) return false

    feedback.beginAction()
    try {
      if (editor.isCreating) {
        const created = await createQuoteProduct<QuoteProductRow>(validated.payload)
        resource.setData((current) => upsertProductIntoVisibleSlice(current, created.data, queryState.query))
        feedback.setSuccessNotice(created.notice ?? 'Product created.')
        clearDeleteDialog()
        queryState.resetVisibleFilters(
          (created.data.family as ProductFamily | null) ?? queryState.activeFamily
        )
        setSelectedIdState(created.data.id)
        setEditorSelected(created.data)
        editor.finishCreate(created.data)
        return true
      }

      if (!selectedId) return false

      const updated = await updateQuoteProduct<QuoteProductRow>(selectedId, validated.payload)
      resource.setData((current) =>
        upsertProductIntoVisibleSlice(current, updated.data, queryState.query, selectedId)
      )
      feedback.setSuccessNotice(updated.notice ?? 'Product saved.')
      clearDeleteDialog()
      queryState.setActiveFamilyState(
        (updated.data.family as ProductFamily | null) ?? queryState.activeFamily
      )
      setSelectedIdState(updated.data.id)
      setEditorSelected(updated.data)
      editor.setDraftFromRow(updated.data)
      return true
    } catch (error) {
      feedback.setErrorMessage(error instanceof Error ? error.message : 'Failed to save product.')
      return false
    } finally {
      feedback.finishAction()
    }
  }

  function requestDelete() {
    if (!editorSelected || editor.isCreating || feedback.saving) return false
    setDeleteTarget(editorSelected)
    return true
  }

  async function confirmDelete() {
    if (!deleteTarget || feedback.saving) return false

    feedback.beginAction()
    try {
      await deleteQuoteProduct(deleteTarget.id)
      resource.setData((current) => removeProductFromVisibleSlice(current, deleteTarget.id))
      feedback.setSuccessNotice('Product deleted.')

      if (selectedId === deleteTarget.id) {
        setSelectedIdState(null)
      }

      if (editorSelected?.id === deleteTarget.id) {
        setEditorSelected(null)
      }

      clearDeleteDialog()
      return true
    } catch (error) {
      feedback.setErrorMessage(error instanceof Error ? error.message : 'Failed to delete product.')
      return false
    } finally {
      feedback.finishAction()
    }
  }

  return {
    save,
    requestDelete,
    confirmDelete,
    cancelDelete: clearDeleteDialog,
    deleteVm: {
      isOpen: Boolean(deleteTarget),
      status: (
        feedback.saving && deleteTarget ? 'deleting' : deleteTarget ? 'confirming' : 'idle'
      ) as 'idle' | 'confirming' | 'deleting',
      productName: deleteTarget?.name ?? null,
    },
    clearDeleteDialog,
  }
}

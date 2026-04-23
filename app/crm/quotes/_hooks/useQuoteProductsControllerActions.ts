'use client'

import type { ProductFamily } from '@/lib/quotes/productsForm'
import type { useDenseQuoteAdminFeedback } from './useDenseQuoteAdminFeedback'
import { useDenseQuoteAdminDiscard } from './useDenseQuoteAdminDiscard'
import type { useQuoteProductEditorState } from './useQuoteProductEditorState'
import type { useQuoteProductMutations } from './useQuoteProductMutations'
import type {
  useQuoteProductsQueryState,
  useQuoteProductsSelectionState,
} from './useQuoteProductsCatalogState'

type Options = {
  queryState: ReturnType<typeof useQuoteProductsQueryState>
  selectionState: ReturnType<typeof useQuoteProductsSelectionState>
  editor: ReturnType<typeof useQuoteProductEditorState>
  mutations: ReturnType<typeof useQuoteProductMutations>
  feedback: ReturnType<typeof useDenseQuoteAdminFeedback>
}

type DiscardCandidateTransition =
  | { type: 'setSelectedId'; selectedId: string | null }
  | { type: 'setActiveFamily'; nextFamily: ProductFamily }
  | { type: 'setStatusFilter'; status: string }
  | { type: 'setSearch'; search: string }
  | { type: 'startCreate' }

export function useQuoteProductsControllerActions({
  queryState,
  selectionState,
  editor,
  mutations,
  feedback,
}: Options) {
  const discard = useDenseQuoteAdminDiscard<DiscardCandidateTransition>({
    isDirty: editor.isDirty,
  })
  const creating = editor.isCreating

  function confirmDiscard() {
    const transition = discard.consumePendingDiscardTransition()
    if (!transition) return false

    switch (transition.type) {
      case 'setSelectedId':
        if (editor.isCreating) {
          editor.cancel(selectionState.selected)
        }
        selectionState.setSelectedId(transition.selectedId)
        return true
      case 'setActiveFamily':
        queryState.setActiveFamily(transition.nextFamily)
        return true
      case 'setStatusFilter':
        if (editor.isCreating) {
          editor.cancel(selectionState.selected)
        }
        queryState.setStatusFilter(transition.status)
        return true
      case 'setSearch':
        if (editor.isCreating) {
          editor.cancel(selectionState.selected)
        }
        queryState.setSearch(transition.search)
        return true
      case 'startCreate':
        editor.startCreate(queryState.activeFamily)
        feedback.clearFeedback()
        return true
      default:
        return false
    }
  }

  function setActiveFamily(nextFamily: ProductFamily) {
    if (discard.hasUnsavedChanges() && !creating && nextFamily !== queryState.activeFamily) {
      discard.queueDiscardTransition({
        type: 'setActiveFamily',
        nextFamily,
      })
      return
    }

    queryState.setActiveFamily(nextFamily)
    if (creating) {
      editor.updateDraftField('family', nextFamily)
    }
  }

  function setSelectedId(id: string | null) {
    if (discard.hasUnsavedChanges() && id !== selectionState.selectedId) {
      discard.queueDiscardTransition({
        type: 'setSelectedId',
        selectedId: id,
      })
      return
    }

    if (creating) {
      editor.cancel(selectionState.selected)
    }
    selectionState.setSelectedId(id)
  }

  function setStatusFilter(next: string) {
    if (discard.hasUnsavedChanges() && next !== queryState.statusFilter) {
      discard.queueDiscardTransition({
        type: 'setStatusFilter',
        status: next,
      })
      return
    }

    queryState.setStatusFilter(next)
  }

  function setSearch(value: string) {
    if (discard.hasUnsavedChanges() && value !== queryState.search) {
      discard.queueDiscardTransition({
        type: 'setSearch',
        search: value,
      })
      return
    }

    queryState.setSearch(value)
  }

  function startCreate() {
    if (discard.hasUnsavedChanges() && !creating) {
      discard.queueDiscardTransition({
        type: 'startCreate',
      })
      return
    }

    editor.startCreate(queryState.activeFamily)
    feedback.clearFeedback()
  }

  function cancelEdit() {
    editor.cancel(selectionState.selected)
    discard.cancelDiscard()
    feedback.clearFeedback()
  }

  async function save() {
    const validated = editor.getValidatedDraft()
    if (!validated.ok) return false

    if (editor.isCreating) {
      const created = await mutations.createProduct(validated.payload)
      if (!created) return false

      feedback.setSuccessNotice(created.notice)
      queryState.setActiveFamily((created.data.family as ProductFamily | null) ?? queryState.activeFamily)
      queryState.setStatusFilter('all')
      queryState.setSearch('')
      selectionState.setSelectedId(created.data.id)
      editor.finishCreate(created.data)
      return true
    }

    if (!selectionState.selected) return false
    const updated = await mutations.updateProduct(selectionState.selected.id, validated.payload)
    if (!updated) return false

    feedback.setSuccessNotice(updated.notice)
    queryState.setActiveFamily((updated.data.family as ProductFamily | null) ?? queryState.activeFamily)
    selectionState.setSelectedId(updated.data.id)
    editor.setDraftFromRow(updated.data)
    return true
  }

  async function requestRemove() {
    if (!selectionState.selected || feedback.saving) return false
    const ok = window.confirm(`Delete "${selectionState.selected.name}"?`)
    if (!ok) return false

    const removedId = selectionState.selected.id
    const removed = await mutations.removeProduct(selectionState.selected)
    if (!removed) return false

    feedback.setSuccessNotice(removed.notice)
    if (selectionState.selectedId === removedId) {
      selectionState.setSelectedId(null)
    }
    return true
  }

  function updateDraftField(field: Parameters<typeof editor.updateDraftField>[0], value: Parameters<typeof editor.updateDraftField>[1]) {
    discard.markPendingMutation()
    editor.updateDraftField(field, value)
  }

  return {
    setActiveFamily,
    setSelectedId,
    setStatusFilter,
    setSearch,
    startCreate,
    cancelEdit,
    updateDraftField,
    confirmDiscard,
    cancelDiscard: discard.cancelDiscard,
    save,
    requestRemove,
    discardVm: {
      isOpen: discard.discardVm.isOpen,
      transitionType: discard.discardVm.transitionType?.type ?? null,
    },
  }
}

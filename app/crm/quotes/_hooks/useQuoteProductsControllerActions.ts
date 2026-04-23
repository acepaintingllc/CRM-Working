'use client'

import type { ProductFamily } from '@/lib/quotes/productsForm'
import type { useDenseQuoteAdminFeedback } from './useDenseQuoteAdminFeedback'
import type { useQuoteProductEditorState } from './useQuoteProductEditorState'
import type { useQuoteProductMutations } from './useQuoteProductMutations'
import type {
  useQuoteProductsQueryState,
  useQuoteProductsSelectionState,
} from './useQuoteProductsCatalogState'
import { useGuardedTransitionWorkflow } from './useGuardedTransitionWorkflow'

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
  const workflow = useGuardedTransitionWorkflow<DiscardCandidateTransition>({
    isDirty: editor.isDirty,
  })

  function discardCreateDraftIfNeeded() {
    if (!editor.isCreatingNow()) return
    editor.cancel(selectionState.editorSelected)
  }

  function confirmDiscard() {
    return workflow.confirmDiscard()
  }

  function setActiveFamily(nextFamily: ProductFamily) {
    return workflow.runTransition({
      transition: {
        type: 'setActiveFamily',
        nextFamily,
      },
      changed: nextFamily !== queryState.activeFamily,
      run: () => {
        queryState.setActiveFamily(nextFamily)
        if (editor.isCreatingNow()) {
          editor.updateDraftField('family', nextFamily)
        }
      },
      replay: (transition) => {
        const nextFamilyTransition = transition as Extract<
          DiscardCandidateTransition,
          { type: 'setActiveFamily' }
        >
        queryState.setActiveFamily(nextFamilyTransition.nextFamily)
        return true
      },
    })
  }

  function setSelectedId(id: string | null) {
    return workflow.runTransition({
      transition: {
        type: 'setSelectedId',
        selectedId: id,
      },
      changed: id !== selectionState.selectedId,
      run: () => {
        discardCreateDraftIfNeeded()
        selectionState.setSelectedId(id)
      },
      replay: (transition) => {
        discardCreateDraftIfNeeded()
        const selectedIdTransition = transition as Extract<
          DiscardCandidateTransition,
          { type: 'setSelectedId' }
        >
        selectionState.setSelectedId(selectedIdTransition.selectedId)
        return true
      },
    })
  }

  function setStatusFilter(next: string) {
    return workflow.runTransition({
      transition: {
        type: 'setStatusFilter',
        status: next,
      },
      changed: next !== queryState.statusFilter,
      run: () => {
        discardCreateDraftIfNeeded()
        queryState.setStatusFilter(next)
      },
      replay: (transition) => {
        discardCreateDraftIfNeeded()
        const statusFilterTransition = transition as Extract<
          DiscardCandidateTransition,
          { type: 'setStatusFilter' }
        >
        queryState.setStatusFilter(statusFilterTransition.status)
        return true
      },
    })
  }

  function setSearch(value: string) {
    return workflow.runTransition({
      transition: {
        type: 'setSearch',
        search: value,
      },
      changed: value !== queryState.search,
      run: () => {
        discardCreateDraftIfNeeded()
        queryState.setSearch(value)
      },
      replay: (transition) => {
        discardCreateDraftIfNeeded()
        const searchTransition = transition as Extract<DiscardCandidateTransition, { type: 'setSearch' }>
        queryState.setSearch(searchTransition.search)
        return true
      },
    })
  }

  function startCreate() {
    return workflow.runTransition({
      transition: {
        type: 'startCreate',
      },
      changed: !editor.isCreatingNow(),
      run: () => {
        editor.startCreate(queryState.activeFamily)
        feedback.clearFeedback()
      },
      replay: () => {
        editor.startCreate(queryState.activeFamily)
        feedback.clearFeedback()
        return true
      },
    })
  }

  function cancelEdit() {
    editor.cancel(selectionState.editorSelected)
    workflow.cancelDiscard()
    feedback.clearFeedback()
  }

  async function save() {
    const validated = editor.getValidatedDraft()
    if (!validated.ok) return false

    if (editor.isCreating) {
      const created = await mutations.createProduct(validated.payload)
      if (!created) return false

      feedback.setSuccessNotice(created.notice)
      queryState.setActiveFamily(
        (created.data.family as ProductFamily | null) ?? queryState.activeFamily
      )
      queryState.setStatusFilter('all')
      queryState.setSearch('')
      selectionState.setSelectedId(created.data.id)
      editor.finishCreate(created.data)
      return true
    }

    if (!selectionState.selectedId) return false
    const updated = await mutations.updateProduct(selectionState.selectedId, validated.payload)
    if (!updated) return false

    feedback.setSuccessNotice(updated.notice)
    queryState.setActiveFamily(
      (updated.data.family as ProductFamily | null) ?? queryState.activeFamily
    )
    selectionState.setSelectedId(updated.data.id)
    editor.setDraftFromRow(updated.data)
    return true
  }

  async function requestRemove() {
    if (!selectionState.editorSelected || feedback.saving) return false
    const ok = window.confirm(`Delete "${selectionState.editorSelected.name}"?`)
    if (!ok) return false

    const removedId = selectionState.editorSelected.id
    const removed = await mutations.removeProduct(selectionState.editorSelected)
    if (!removed) return false

    feedback.setSuccessNotice(removed.notice)
    if (selectionState.selectedId === removedId) {
      selectionState.setSelectedId(null)
    }
    return true
  }

  function updateDraftField(
    field: Parameters<typeof editor.updateDraftField>[0],
    value: Parameters<typeof editor.updateDraftField>[1]
  ) {
    workflow.markPendingMutation()
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
    cancelDiscard: workflow.cancelDiscard,
    save,
    requestRemove,
    discardVm: {
      isOpen: workflow.workflowVm.isOpen,
      phase: workflow.workflowVm.phase,
      transitionType: workflow.workflowVm.pendingTransitionType as
        | DiscardCandidateTransition['type']
        | null,
    },
  }
}

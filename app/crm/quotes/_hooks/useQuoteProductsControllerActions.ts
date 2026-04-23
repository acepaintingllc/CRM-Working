'use client'

import type { ProductFamily } from '@/lib/quotes/productsForm'
import type { useDenseQuoteAdminFeedback } from './useDenseQuoteAdminFeedback'
import { useGuardedEditorWorkflow } from './useGuardedEditorWorkflow'
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
  const workflow = useGuardedEditorWorkflow<DiscardCandidateTransition>({
    isDirty: editor.isDirty,
  })
  const creating = editor.isCreating

  function replayTransition(transition: DiscardCandidateTransition) {
    switch (transition.type) {
      case 'setSelectedId':
        if (editor.isCreating) {
          editor.cancel(selectionState.editorSelected)
        }
        selectionState.setSelectedId(transition.selectedId)
        return true
      case 'setActiveFamily':
        queryState.setActiveFamily(transition.nextFamily)
        return true
      case 'setStatusFilter':
        if (editor.isCreating) {
          editor.cancel(selectionState.editorSelected)
        }
        queryState.setStatusFilter(transition.status)
        return true
      case 'setSearch':
        if (editor.isCreating) {
          editor.cancel(selectionState.editorSelected)
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

  function confirmDiscard() {
    return workflow.confirmDiscard(replayTransition)
  }

  function setActiveFamily(nextFamily: ProductFamily) {
    return workflow.runGuarded(
      {
        type: 'setActiveFamily',
        nextFamily,
      },
      {
        changed: !creating && nextFamily !== queryState.activeFamily,
        run: () => {
          queryState.setActiveFamily(nextFamily)
          if (creating) {
            editor.updateDraftField('family', nextFamily)
          }
        },
      })
  }

  function setSelectedId(id: string | null) {
    return workflow.runGuarded(
      {
        type: 'setSelectedId',
        selectedId: id,
      },
      {
        changed: id !== selectionState.selectedId,
        run: () => {
          if (creating) {
            editor.cancel(selectionState.editorSelected)
          }
          selectionState.setSelectedId(id)
        },
      })
  }

  function setStatusFilter(next: string) {
    return workflow.runGuarded(
      {
        type: 'setStatusFilter',
        status: next,
      },
      {
        changed: next !== queryState.statusFilter,
        run: () => {
          queryState.setStatusFilter(next)
        },
      })
  }

  function setSearch(value: string) {
    return workflow.runGuarded(
      {
        type: 'setSearch',
        search: value,
      },
      {
        changed: value !== queryState.search,
        run: () => {
          queryState.setSearch(value)
        },
      })
  }

  function startCreate() {
    return workflow.runGuarded(
      {
        type: 'startCreate',
      },
      {
        changed: !creating,
        run: () => {
          editor.startCreate(queryState.activeFamily)
          feedback.clearFeedback()
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
      queryState.setActiveFamily((created.data.family as ProductFamily | null) ?? queryState.activeFamily)
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
    queryState.setActiveFamily((updated.data.family as ProductFamily | null) ?? queryState.activeFamily)
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

  function updateDraftField(field: Parameters<typeof editor.updateDraftField>[0], value: Parameters<typeof editor.updateDraftField>[1]) {
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

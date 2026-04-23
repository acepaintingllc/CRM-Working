'use client'

import type { ProductFamily } from '@/lib/quotes/productsForm'
import type { useDenseQuoteAdminFeedback } from './useDenseQuoteAdminFeedback'
import type { useQuoteProductEditorState } from './useQuoteProductEditorState'
import type { useQuoteProductMutations } from './useQuoteProductMutations'
import type {
  useQuoteProductsQueryState,
  useQuoteProductsSelectionState,
} from './useQuoteProductsCatalogState'
import { useQuoteAdminIntentGuard } from './useQuoteAdminIntentGuard'

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
  const guard = useQuoteAdminIntentGuard<DiscardCandidateTransition>({
    hasUnsavedChanges: editor.isDirty,
    getHasUnsavedChanges: editor.isDirtyNow,
    getIntentType: (intent) => intent.type,
  })

  function discardCreateDraftIfNeeded() {
    if (!editor.isCreatingNow()) return
    editor.cancel(selectionState.editorSelected)
  }

  function applyIntent(transition: DiscardCandidateTransition) {
    switch (transition.type) {
      case 'setActiveFamily':
        queryState.setActiveFamily(transition.nextFamily)
        if (editor.isCreatingNow()) {
          editor.updateDraftField('family', transition.nextFamily)
        }
        return true
      case 'setSelectedId':
        discardCreateDraftIfNeeded()
        selectionState.setSelectedId(transition.selectedId)
        return true
      case 'setStatusFilter':
        discardCreateDraftIfNeeded()
        queryState.setStatusFilter(transition.status)
        return true
      case 'setSearch':
        discardCreateDraftIfNeeded()
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
    return guard.confirmDiscard(applyIntent)
  }

  function setActiveFamily(nextFamily: ProductFamily) {
    return guard.requestIntent(
      {
        type: 'setActiveFamily',
        nextFamily,
      },
      {
        changed: nextFamily !== queryState.activeFamily,
        run: () => applyIntent({ type: 'setActiveFamily', nextFamily }),
      }
    )
  }

  function setSelectedId(id: string | null) {
    return guard.requestIntent(
      {
        type: 'setSelectedId',
        selectedId: id,
      },
      {
        changed: id !== selectionState.selectedId,
        run: () => applyIntent({ type: 'setSelectedId', selectedId: id }),
      }
    )
  }

  function setStatusFilter(next: string) {
    return guard.requestIntent(
      {
        type: 'setStatusFilter',
        status: next,
      },
      {
        changed: next !== queryState.statusFilter,
        run: () => applyIntent({ type: 'setStatusFilter', status: next }),
      }
    )
  }

  function setSearch(value: string) {
    return guard.requestIntent(
      {
        type: 'setSearch',
        search: value,
      },
      {
        changed: value !== queryState.search,
        run: () => applyIntent({ type: 'setSearch', search: value }),
      }
    )
  }

  function startCreate() {
    return guard.requestIntent(
      {
        type: 'startCreate',
      },
      {
        changed: !editor.isCreatingNow(),
        run: () => applyIntent({ type: 'startCreate' }),
      }
    )
  }

  function cancelEdit() {
    editor.cancel(selectionState.editorSelected)
    guard.cancelDiscard()
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
    cancelDiscard: guard.cancelDiscard,
    save,
    requestRemove,
    discardVm: {
      isOpen: guard.discardVm.isOpen,
      status: guard.discardVm.status,
      transitionType: guard.discardVm.intentType as
        | DiscardCandidateTransition['type']
        | null,
    },
  }
}

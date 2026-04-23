'use client'

import { useEffect, useRef, useState } from 'react'
import type { ProductFamily } from '@/lib/quotes/productsForm'
import type { useDenseQuoteAdminFeedback } from './useDenseQuoteAdminFeedback'
import type { useQuoteProductEditorState } from './useQuoteProductEditorState'
import type { useQuoteProductMutations } from './useQuoteProductMutations'
import type { useQuoteProductsCatalogState } from './useQuoteProductsCatalogState'

type Options = {
  catalog: ReturnType<typeof useQuoteProductsCatalogState>
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
  catalog,
  editor,
  mutations,
  feedback,
}: Options) {
  const [pendingDiscardTransition, setPendingDiscardTransition] =
    useState<DiscardCandidateTransition | null>(null)
  const hasPendingMutationRef = useRef(false)

  const editorNeedsDiscard = editor.isDirty
  const creating = editor.isCreating

  useEffect(() => {
    if (!editorNeedsDiscard) {
      setPendingDiscardTransition(null)
    }
  }, [editorNeedsDiscard])

  useEffect(() => {
    if (!editorNeedsDiscard) {
      hasPendingMutationRef.current = false
    }
  }, [editorNeedsDiscard])

  const hasUnsavedChanges = () => {
    return editorNeedsDiscard || hasPendingMutationRef.current
  }

  function cancelDiscard() {
    setPendingDiscardTransition(null)
  }

  function queueDiscardTransition(transition: DiscardCandidateTransition) {
    if (pendingDiscardTransition) return
    setPendingDiscardTransition(transition)
  }

  function confirmDiscard() {
    const transition = pendingDiscardTransition
    setPendingDiscardTransition(null)
    if (!transition) return false

    switch (transition.type) {
      case 'setSelectedId':
        if (editor.isCreating) {
          editor.cancel(catalog.selected)
        }
        catalog.setSelectedId(transition.selectedId)
        return true
      case 'setActiveFamily':
        catalog.setActiveFamily(transition.nextFamily)
        return true
      case 'setStatusFilter':
        if (editor.isCreating) {
          editor.cancel(catalog.selected)
        }
        catalog.setStatusFilter(transition.status)
        return true
      case 'setSearch':
        if (editor.isCreating) {
          editor.cancel(catalog.selected)
        }
        catalog.setSearch(transition.search)
        return true
      case 'startCreate':
        editor.startCreate(catalog.activeFamily)
        feedback.clearFeedback()
        return true
      default:
        return false
    }
  }

  function setActiveFamily(nextFamily: ProductFamily) {
    if (hasUnsavedChanges() && !creating && nextFamily !== catalog.activeFamily) {
      queueDiscardTransition({
        type: 'setActiveFamily',
        nextFamily,
      })
      return
    }

    catalog.setActiveFamily(nextFamily)
    if (creating) {
      editor.updateDraftField('family', nextFamily)
    }
  }

  function setSelectedId(id: string | null) {
    if (hasUnsavedChanges() && id !== catalog.selectedId) {
      queueDiscardTransition({
        type: 'setSelectedId',
        selectedId: id,
      })
      return
    }

    if (creating) {
      editor.cancel(catalog.selected)
    }
    catalog.setSelectedId(id)
  }

  function setStatusFilter(next: string) {
    if (hasUnsavedChanges() && next !== catalog.statusFilter) {
      queueDiscardTransition({
        type: 'setStatusFilter',
        status: next,
      })
      return
    }

    catalog.setStatusFilter(next)
  }

  function setSearch(value: string) {
    if (hasUnsavedChanges() && value !== catalog.search) {
      queueDiscardTransition({
        type: 'setSearch',
        search: value,
      })
      return
    }

    catalog.setSearch(value)
  }

  function startCreate() {
    if (hasUnsavedChanges() && !creating) {
      queueDiscardTransition({
        type: 'startCreate',
      })
      return
    }

    editor.startCreate(catalog.activeFamily)
    feedback.clearFeedback()
  }

  function cancelEdit() {
    editor.cancel(catalog.selected)
    cancelDiscard()
    feedback.clearFeedback()
  }

  async function save() {
    const validated = editor.getValidatedDraft()
    if (!validated.ok) return false

    if (editor.isCreating) {
      const created = await mutations.createProduct(validated.payload)
      if (!created) return false

      feedback.setSuccessNotice(created.notice)
      catalog.setActiveFamily((created.data.family as ProductFamily | null) ?? catalog.activeFamily)
      catalog.setStatusFilter('all')
      catalog.setSearch('')
      catalog.setSelectedId(created.data.id)
      editor.finishCreate(created.data)
      return true
    }

    if (!catalog.selected) return false
    const updated = await mutations.updateProduct(catalog.selected.id, validated.payload)
    if (!updated) return false

    feedback.setSuccessNotice(updated.notice)
    catalog.setActiveFamily((updated.data.family as ProductFamily | null) ?? catalog.activeFamily)
    catalog.setSelectedId(updated.data.id)
    editor.setDraftFromRow(updated.data)
    return true
  }

  async function requestRemove() {
    if (!catalog.selected || feedback.saving) return false
    const ok = window.confirm(`Delete "${catalog.selected.name}"?`)
    if (!ok) return false

    const removedId = catalog.selected.id
    const removed = await mutations.removeProduct(catalog.selected)
    if (!removed) return false

    feedback.setSuccessNotice(removed.notice)
    if (catalog.selectedId === removedId) {
      catalog.setSelectedId(null)
    }
    return true
  }

  function updateDraftField(field: Parameters<typeof editor.updateDraftField>[0], value: Parameters<typeof editor.updateDraftField>[1]) {
    hasPendingMutationRef.current = true
    editor.updateDraftField(field, value)
  }

  const discardVm = {
    isOpen: Boolean(pendingDiscardTransition),
    transitionType: pendingDiscardTransition?.type ?? null,
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
    cancelDiscard,
    save,
    requestRemove,
    discardVm,
  }
}

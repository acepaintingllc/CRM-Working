'use client'

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

export function useQuoteProductsControllerActions({
  catalog,
  editor,
  mutations,
  feedback,
}: Options) {
  function setActiveFamily(nextFamily: ProductFamily) {
    catalog.setActiveFamily(nextFamily)
    if (editor.isCreating) {
      editor.updateDraftField('family', nextFamily)
    }
  }

  function setSelectedId(id: string | null) {
    if (editor.isCreating) {
      editor.cancel(catalog.selected)
    }
    catalog.setSelectedId(id)
  }

  function startCreate() {
    editor.startCreate(catalog.activeFamily)
    feedback.clearFeedback()
  }

  function cancelEdit() {
    editor.cancel(catalog.selected)
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

  return {
    setActiveFamily,
    setSelectedId,
    startCreate,
    cancelEdit,
    save,
    requestRemove,
  }
}

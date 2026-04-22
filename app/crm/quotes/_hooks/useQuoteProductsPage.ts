'use client'

import { useState } from 'react'
import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import { buildDenseQuotePageUiState } from '@/app/crm/quotes/_hooks/denseQuotePageUiState'
import { loadQuoteProducts } from '@/lib/quotes/client'
import {
  QUOTE_PRODUCT_FAMILIES,
  type ProductFamily,
  type QuoteProductRow,
  type QuoteProductStatusFilter,
} from '@/lib/quotes/productsForm'
import { useQuoteProductEditorState } from './useQuoteProductEditorState'
import { useQuoteProductMutations } from './useQuoteProductMutations'
import { useQuoteProductsCatalogState } from './useQuoteProductsCatalogState'

const emptyProductRows: QuoteProductRow[] = []

export function useQuoteProductsPage() {
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const resource = useLoadableResource<QuoteProductRow[]>({
    initialData: emptyProductRows,
    load: () => loadQuoteProducts<QuoteProductRow[]>({ status: 'all' }),
    getErrorMessage: (loadError: unknown) =>
      loadError instanceof Error ? loadError.message : 'Failed to load quote products.',
  })

  const catalogVm = useQuoteProductsCatalogState({
    products: resource.data,
  })

  const editor = useQuoteProductEditorState({
    selected: catalogVm.selected,
  })

  const mutations = useQuoteProductMutations({
    setData: resource.setData,
    setSaving,
    setActionError,
    setNotice,
  })

  const validation = editor.validation
  const uiState = buildDenseQuotePageUiState({
    loading: resource.loading,
    hasData: resource.data.length > 0 || (!resource.loading && !resource.error),
    loadError: resource.error,
    actionError,
    validationError: validation.ok ? null : validation.summary,
    notice,
    canRetry: !resource.loading,
    canSave:
      !saving &&
      validation.ok &&
      !resource.error &&
      (editor.isCreating || Boolean(catalogVm.selected)),
    canDelete: Boolean(catalogVm.selected) && !editor.isCreating && !saving && !resource.error,
  })

  function setActiveFamily(nextFamily: ProductFamily) {
    catalogVm.setActiveFamily(nextFamily)
    if (editor.isCreating) {
      editor.updateDraftField('family', nextFamily)
    }
  }

  function setSelectedId(id: string | null) {
    if (editor.isCreating) {
      editor.cancel(catalogVm.selected)
    }
    catalogVm.setSelectedId(id)
  }

  function startCreate() {
    editor.startCreate(catalogVm.activeFamily)
    setNotice(null)
    setActionError(null)
  }

  function cancelEdit() {
    editor.cancel(catalogVm.selected)
    setNotice(null)
    setActionError(null)
  }

  async function save() {
    const validated = editor.getValidatedDraft()
    if (!validated.ok) return false

    if (editor.isCreating) {
      const created = await mutations.createProduct(validated.payload)
      if (!created) return false
      catalogVm.setActiveFamily((created.family as ProductFamily | null) ?? catalogVm.activeFamily)
      catalogVm.setStatusFilter('all')
      catalogVm.setSearch('')
      catalogVm.setSelectedId(created.id)
      editor.finishCreate(created)
      return true
    }

    if (!catalogVm.selected) return false
    const updated = await mutations.updateProduct(catalogVm.selected.id, validated.payload)
    if (!updated) return false
    catalogVm.setActiveFamily((updated.family as ProductFamily | null) ?? catalogVm.activeFamily)
    catalogVm.setSelectedId(updated.id)
    return true
  }

  async function remove() {
    if (!catalogVm.selected || saving) return false
    const removedId = catalogVm.selected.id
    const ok = await mutations.removeProduct(catalogVm.selected)
    if (!ok) return false
    if (catalogVm.selectedId === removedId) {
      catalogVm.setSelectedId(null)
    }
    return true
  }

  return {
    resource,
    activeFamily: catalogVm.activeFamily,
    setActiveFamily,
    families: QUOTE_PRODUCT_FAMILIES,
    statusFilter: catalogVm.statusFilter as QuoteProductStatusFilter,
    setStatusFilter: catalogVm.setStatusFilter,
    search: catalogVm.search,
    setSearch: catalogVm.setSearch,
    filtered: catalogVm.filtered,
    selected: catalogVm.selected,
    selectedId: catalogVm.selectedId,
    setSelectedId,
    isCreating: editor.isCreating,
    draft: editor.draft,
    saving,
    validation,
    save,
    remove,
    startCreate,
    cancelEdit,
    uiState,
    catalogVm: {
      activeFamily: catalogVm.activeFamily,
      families: QUOTE_PRODUCT_FAMILIES,
      statusFilter: catalogVm.statusFilter,
      search: catalogVm.search,
      filtered: catalogVm.filtered,
      selectedId: catalogVm.selectedId,
      selected: catalogVm.selected,
    },
    editorVm: {
      draft: editor.draft,
      selected: catalogVm.selected,
      saving,
      isCreating: editor.isCreating,
      validation,
      inlineValidation: uiState.inlineValidation,
      canSave: uiState.canSave,
      canDelete: uiState.canDelete,
    },
    actions: {
      setActiveFamily,
      setStatusFilter: catalogVm.setStatusFilter,
      setSearch: catalogVm.setSearch,
      setSelectedId,
      updateDraftField: editor.updateDraftField,
      startCreate,
      cancelEdit,
      save,
      remove,
    },
  }
}

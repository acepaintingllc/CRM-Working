'use client'

import { useState } from 'react'
import { buildDenseQuotePageUiState } from '@/app/crm/quotes/_hooks/denseQuotePageUiState'
import {
  QUOTE_PRODUCT_FAMILIES,
  type ProductFamily,
  type QuoteProductStatusFilter,
} from '@/lib/quotes/productsForm'
import { useQuoteProductEditorState } from './useQuoteProductEditorState'
import { useQuoteProductMutations } from './useQuoteProductMutations'
import { useQuoteProductsCatalogState } from './useQuoteProductsCatalogState'
import { useQuoteProductsData } from './useQuoteProductsData'

export type QuoteProductsCatalogVm = {
  activeFamily: ProductFamily
  families: readonly ProductFamily[]
  statusFilter: QuoteProductStatusFilter
  search: string
  filtered: ReturnType<typeof useQuoteProductsCatalogState>['filtered']
  selectedId: string | null
  selected: ReturnType<typeof useQuoteProductsCatalogState>['selected']
}

export type QuoteProductsEditorVm = {
  draft: ReturnType<typeof useQuoteProductEditorState>['draft']
  selected: ReturnType<typeof useQuoteProductsCatalogState>['selected']
  saving: boolean
  isCreating: boolean
  validation: ReturnType<typeof useQuoteProductEditorState>['validation']
  inlineValidation: string | null
  canSave: boolean
  canDelete: boolean
}

export type QuoteProductsActions = {
  setActiveFamily: (nextFamily: ProductFamily) => void
  setStatusFilter: (next: string) => void
  setSearch: (value: string) => void
  setSelectedId: (id: string | null) => void
  updateDraftField: ReturnType<typeof useQuoteProductEditorState>['updateDraftField']
  startCreate: () => void
  cancelEdit: () => void
  save: () => Promise<boolean>
  requestRemove: () => Promise<boolean>
}

export function useQuoteProductsPage() {
  const resource = useQuoteProductsData()
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const catalog = useQuoteProductsCatalogState({
    products: resource.data,
  })

  const editor = useQuoteProductEditorState({
    selected: catalog.selected,
  })

  const mutations = useQuoteProductMutations({
    setData: resource.setData,
    setSaving,
    setActionError,
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
      (editor.isCreating || Boolean(catalog.selected)),
    canDelete: Boolean(catalog.selected) && !editor.isCreating && !saving && !resource.error,
  })

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
    setNotice(null)
    setActionError(null)
  }

  function cancelEdit() {
    editor.cancel(catalog.selected)
    setNotice(null)
    setActionError(null)
  }

  async function save() {
    const validated = editor.getValidatedDraft()
    if (!validated.ok) return false

    setNotice(null)
    if (editor.isCreating) {
      const created = await mutations.createProduct(validated.payload)
      if (!created) return false
      setNotice(created.notice)
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
    setNotice(updated.notice)
    catalog.setActiveFamily((updated.data.family as ProductFamily | null) ?? catalog.activeFamily)
    catalog.setSelectedId(updated.data.id)
    return true
  }

  async function requestRemove() {
    if (!catalog.selected || saving) return false
    const ok = window.confirm(`Delete "${catalog.selected.name}"?`)
    if (!ok) return false

    setNotice(null)
    const removedId = catalog.selected.id
    const removed = await mutations.removeProduct(catalog.selected)
    if (!removed) return false
    setNotice(removed.notice)
    if (catalog.selectedId === removedId) {
      catalog.setSelectedId(null)
    }
    return true
  }

  return {
    resource,
    activeFamily: catalog.activeFamily,
    setActiveFamily,
    families: QUOTE_PRODUCT_FAMILIES,
    statusFilter: catalog.statusFilter as QuoteProductStatusFilter,
    setStatusFilter: catalog.setStatusFilter,
    search: catalog.search,
    setSearch: catalog.setSearch,
    filtered: catalog.filtered,
    selected: catalog.selected,
    selectedId: catalog.selectedId,
    setSelectedId,
    isCreating: editor.isCreating,
    draft: editor.draft,
    saving,
    validation,
    save,
    remove: requestRemove,
    startCreate,
    cancelEdit,
    uiState,
    catalogVm: {
      activeFamily: catalog.activeFamily,
      families: QUOTE_PRODUCT_FAMILIES,
      statusFilter: catalog.statusFilter,
      search: catalog.search,
      filtered: catalog.filtered,
      selectedId: catalog.selectedId,
      selected: catalog.selected,
    } satisfies QuoteProductsCatalogVm,
    editorVm: {
      draft: editor.draft,
      selected: catalog.selected,
      saving,
      isCreating: editor.isCreating,
      validation,
      inlineValidation: uiState.inlineValidation,
      canSave: uiState.canSave,
      canDelete: uiState.canDelete,
    } satisfies QuoteProductsEditorVm,
    actions: {
      setActiveFamily,
      setStatusFilter: catalog.setStatusFilter,
      setSearch: catalog.setSearch,
      setSelectedId,
      updateDraftField: editor.updateDraftField,
      startCreate,
      cancelEdit,
      save,
      requestRemove,
    } satisfies QuoteProductsActions,
  }
}

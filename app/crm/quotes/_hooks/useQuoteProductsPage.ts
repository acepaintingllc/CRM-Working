'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import { buildDenseQuotePageUiState } from '@/app/crm/quotes/_hooks/denseQuotePageUiState'
import {
  deleteQuoteProduct,
  loadQuoteProducts,
  updateQuoteProduct,
} from '@/lib/quotes/client'
import {
  QUOTE_PRODUCT_FAMILIES,
  createEmptyQuoteProductDraft,
  quoteProductRowToDraft,
  validateQuoteProductDraft,
  type ProductFamily,
  type QuoteProductDraft,
  type QuoteProductValidationState,
  type QuoteProductRow,
} from '@/lib/quotes/productsForm'

const emptyProductRows: QuoteProductRow[] = []

export function useQuoteProductsPage() {
  const [activeFamily, setActiveFamily] = useState<ProductFamily>('Paint')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<QuoteProductDraft>(() => createEmptyQuoteProductDraft())
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const resource = useLoadableResource<QuoteProductRow[]>({
    initialData: emptyProductRows,
    load: () => loadQuoteProducts<QuoteProductRow[]>(),
    getErrorMessage: (loadError: unknown) =>
      loadError instanceof Error ? loadError.message : 'Failed to load quote products.',
  })

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return resource.data.filter((product) => {
      if (product.family !== activeFamily) return false
      if (!query) return true
      const haystack =
        `${product.name} ${product.base ?? ''} ${product.subtype ?? ''} ${product.notes ?? ''}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [activeFamily, resource.data, search])

  const selected = useMemo(
    () => filtered.find((product) => product.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId]
  )

  useEffect(() => {
    if (!selected && filtered.length === 0) {
      setSelectedId(null)
      setDraft(createEmptyQuoteProductDraft())
      return
    }
    if (selected) {
      setSelectedId(selected.id)
    }
  }, [filtered, selected])

  useEffect(() => {
    if (!selected) return
    setDraft(quoteProductRowToDraft(selected))
  }, [selected])

  const validationResult = validateQuoteProductDraft(draft)
  const validation: QuoteProductValidationState = validationResult.validation
  const uiState = buildDenseQuotePageUiState({
    loading: resource.loading,
    hasData: resource.data.length > 0 || (!resource.loading && !resource.error),
    loadError: resource.error,
    actionError,
    validationError: validation.ok ? null : validation.summary,
    notice,
    canRetry: !resource.loading,
    canSave: Boolean(selected) && !saving && validation.ok && !resource.error,
    canDelete: Boolean(selected) && !saving && !resource.error,
  })
  const catalogVm = {
    activeFamily,
    families: QUOTE_PRODUCT_FAMILIES,
    search,
    filtered,
    selectedId,
    selected,
  }
  const editorVm = {
    draft: validationResult.draft,
    selected,
    saving,
    validation,
    inlineValidation: uiState.inlineValidation,
    canSave: uiState.canSave,
    canDelete: uiState.canDelete,
  }

  function updateDraftField<K extends keyof QuoteProductDraft>(
    field: K,
    value: QuoteProductDraft[K]
  ) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function save() {
    if (!selected) return false
    setActionError(null)
    setNotice(null)
    const validated = validateQuoteProductDraft(draft)
    setDraft(validated.draft)
    if (!validated.ok) {
      return false
    }

    setSaving(true)
    try {
      const updated = await updateQuoteProduct<QuoteProductRow>(selected.id, validated.payload)
      resource.setData((current) =>
        current.map((product) => (product.id === selected.id ? updated.data : product))
      )
      setNotice(updated.notice ?? 'Product saved.')
      return true
    } catch (saveError) {
      setActionError(saveError instanceof Error ? saveError.message : 'Failed to save product.')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!selected || saving) return false
    const ok = window.confirm(`Delete "${selected.name}"?`)
    if (!ok) return false
    setSaving(true)
    setActionError(null)
    setNotice(null)
    try {
      await deleteQuoteProduct(selected.id)
      resource.setData((current) => current.filter((product) => product.id !== selected.id))
      setSelectedId(null)
      setNotice('Product deleted.')
      return true
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error ? deleteError.message : 'Failed to delete product.'
      )
      return false
    } finally {
      setSaving(false)
    }
  }

  return {
    resource,
    activeFamily,
    setActiveFamily,
    families: QUOTE_PRODUCT_FAMILIES,
    search,
    setSearch,
    filtered,
    selected,
    selectedId,
    setSelectedId,
    draft: validationResult.draft,
    saving,
    validation,
    save,
    remove,
    uiState,
    catalogVm,
    editorVm,
    actions: {
      setActiveFamily,
      setSearch,
      setSelectedId,
      updateDraftField,
      save,
      remove,
    },
  }
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import {
  deleteQuoteProduct,
  loadQuoteProducts,
  updateQuoteProduct,
} from '@/lib/quotes/client'
import {
  quoteProductToFormValues,
  validateQuoteProductFormValues,
  type ProductFamily,
  type QuoteProductFormValues,
  type QuoteProductRow,
} from '@/lib/quotes/productsForm'

const PRODUCT_FAMILIES: ProductFamily[] = ['Paint', 'Primer']
const emptyProductRows: QuoteProductRow[] = []

export function useQuoteProductsPage() {
  const [activeFamily, setActiveFamily] = useState<ProductFamily>('Paint')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [formState, setFormState] = useState<QuoteProductFormValues>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
      setFormState({})
      return
    }
    if (selected) {
      setSelectedId(selected.id)
    }
  }, [filtered, selected])

  useEffect(() => {
    if (!selected) return
    setFormState(quoteProductToFormValues(selected))
  }, [selected])

  const validation = validateQuoteProductFormValues(formState)
  const validationError = validation.ok ? null : validation.error
  const feedbackVm = {
    loading: resource.loading,
    error: resource.error,
    mutationError: error,
    notice,
    hasData:
      resource.data.length > 0 || (!resource.loading && !resource.error),
  }
  const catalogVm = {
    activeFamily,
    families: PRODUCT_FAMILIES,
    search,
    filtered,
    selectedId,
    selected,
  }
  const editorVm = {
    formState,
    selected,
    saving,
    validationError: error ? null : validationError,
  }

  async function save() {
    if (!selected) return false
    setError(null)
    setNotice(null)
    const validated = validateQuoteProductFormValues(formState)
    if (!validated.ok) {
      setError(validated.error)
      return false
    }

    setSaving(true)
    try {
      const updated = await updateQuoteProduct<QuoteProductRow>(selected.id, validated.value)
      resource.setData((current) =>
        current.map((product) => (product.id === selected.id ? updated.data : product))
      )
      setNotice(updated.notice ?? 'Product saved.')
      return true
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save product.')
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
    setError(null)
    setNotice(null)
    try {
      await deleteQuoteProduct(selected.id)
      resource.setData((current) => current.filter((product) => product.id !== selected.id))
      setSelectedId(null)
      setNotice('Product deleted.')
      return true
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete product.')
      return false
    } finally {
      setSaving(false)
    }
  }

  return {
    resource,
    activeFamily,
    setActiveFamily,
    families: PRODUCT_FAMILIES,
    search,
    setSearch,
    filtered,
    selected,
    selectedId,
    setSelectedId,
    formState,
    setFormState,
    saving,
    error,
    notice,
    validationError: error ? null : validationError,
    save,
    remove,
    feedbackVm,
    catalogVm,
    editorVm,
    actions: {
      setActiveFamily,
      setSearch,
      setSelectedId,
      setFormState,
      save,
      remove,
    },
  }
}

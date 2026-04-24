'use client'

import { useMemo } from 'react'
import { useEditableResource } from '@/app/crm/_hooks/useEditableResource'
import { buildQuoteAdminPageStatus } from '@/app/crm/quotes/_hooks/quoteAdminPageFeedback'
import { loadQuoteDefaults, loadQuoteProducts, saveQuoteDefaults } from '@/lib/quotes/client'
import {
  areQuoteDefaultsEqual,
  normalizeQuoteDefaults,
  quoteDefaultsProductFields,
  validateQuoteDefaults,
} from '@/lib/quotes/defaultsForm'
import type { QuoteDefaults } from '@/lib/settings/types'

type ProductRow = {
  id: string
  name: string
  family?: string | null
  status?: string | null
  missing?: boolean
}

type QuoteDefaultsResource = {
  settings: QuoteDefaults
  products: ProductRow[]
}

const emptyResource: QuoteDefaultsResource = {
  settings: normalizeQuoteDefaults(),
  products: [],
}

export function useQuoteDefaultsPage() {
  const resource = useEditableResource({
    initialData: emptyResource,
    load: async () => {
      const [products, settings] = await Promise.all([
        loadQuoteProducts<ProductRow[]>({ status: 'all' }),
        loadQuoteDefaults(),
      ])

      return {
        settings: normalizeQuoteDefaults(settings),
        products,
      }
    },
    save: async (current) => {
      const validated = validateQuoteDefaults(current.settings, { products: current.products })
      if (!validated.ok) {
        throw new Error(validated.error)
      }

      const result = await saveQuoteDefaults(validated.value)
      return {
        data: {
          settings: normalizeQuoteDefaults(result.data ?? validated.value),
          products: current.products,
        },
        notice: result.notice ?? 'Quote defaults saved.',
      }
    },
    getErrorMessage: (error: unknown) =>
      error instanceof Error ? error.message : 'Failed to save quote defaults.',
    isDirty: (current, snapshot) => !areQuoteDefaultsEqual(current.settings, snapshot.settings),
  })

  const productDefaultFields = useMemo(() => {
    return quoteDefaultsProductFields.map((field) => ({
      ...field,
      options: buildProductOptionsForDefaultField(
        resource.data.products,
        resource.data.settings[field.key],
        field.expectedFamily
      ),
    }))
  }, [resource.data.products, resource.data.settings])

  const validation = validateQuoteDefaults(resource.data.settings, { products: resource.data.products })
  const validationError = validation.ok ? null : validation.error
  const canSave = resource.hasLoaded && resource.dirty && !resource.saving && !validationError
  const status = buildQuoteAdminPageStatus({
    loading: resource.loading,
    hasData: resource.hasLoaded,
    loadError: resource.hasLoaded ? null : resource.error,
    actionError: resource.hasLoaded ? resource.error : null,
    validationError: resource.error ? null : validationError,
    notice: resource.notice,
    canRetry: !resource.loading,
  })
  const form = {
    settings: resource.data.settings,
    productDefaultFields,
    productDefaultErrors: validation.fields,
    validationError: status.inlineValidation,
    canSave,
  }
  const actions = {
    reload: () => resource.reload(),
    save: () => resource.saveChanges(),
    setSettings: (next: QuoteDefaults) =>
      resource.setData((current) => ({ ...current, settings: next })),
  }

  return {
    feedback: {
      ...status,
      hasLoaded: resource.hasLoaded,
      saving: resource.saving,
    },
    form,
    actions,
  }
}

function buildProductOptionsForDefaultField(
  products: ProductRow[],
  selectedProductId: string | null,
  expectedFamily: string
) {
  const activeOptions = products.filter(
    (product) =>
      productMatchesFamily(product, expectedFamily) && productIsActive(product)
  )

  if (!selectedProductId) return activeOptions

  const selectedProduct = products.find((product) => product.id === selectedProductId)
  const selectedAlreadyVisible = activeOptions.some((product) => product.id === selectedProductId)

  if (selectedAlreadyVisible) return activeOptions

  if (selectedProduct) {
    return [selectedProduct, ...activeOptions]
  }

  return [
    {
      id: selectedProductId,
      name: `Missing product (${selectedProductId})`,
      family: null,
      status: 'Missing',
      missing: true,
    },
    ...activeOptions,
  ]
}

function productMatchesFamily(product: ProductRow, expectedFamily: string) {
  return String(product.family ?? '').trim().toLowerCase() === expectedFamily.toLowerCase()
}

function productIsActive(product: ProductRow) {
  if (product.status == null) return true
  return String(product.status).trim().toLowerCase() === 'active'
}

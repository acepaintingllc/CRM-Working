'use client'

import { useMemo } from 'react'
import { useEditableResource } from '@/app/crm/_hooks/useEditableResource'
import { buildQuoteAdminPageStatus } from '@/app/crm/quotes/_hooks/quoteAdminPageFeedback'
import { loadQuoteDefaults, loadQuoteProducts, saveQuoteDefaults } from '@/lib/quotes/client'
import {
  areQuoteDefaultsEqual,
  normalizeQuoteDefaults,
  validateQuoteDefaults,
} from '@/lib/quotes/defaultsForm'
import type { QuoteDefaults } from '@/lib/settings/types'

type ProductRow = {
  id: string
  name: string
  family?: string | null
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
        loadQuoteProducts<ProductRow[]>({ status: 'active' }),
        loadQuoteDefaults(),
      ])

      return {
        settings: normalizeQuoteDefaults(settings),
        products,
      }
    },
    save: async (current) => {
      const validated = validateQuoteDefaults(current.settings)
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
    const paintProducts = resource.data.products.filter(
      (product) => (product.family ?? '').toLowerCase() === 'paint'
    )
    const primerProducts = resource.data.products.filter(
      (product) => (product.family ?? '').toLowerCase() === 'primer'
    )

    return [
      { label: 'Walls default paint', key: 'walls_paint_id', options: paintProducts },
      { label: 'Walls default primer', key: 'walls_primer_id', options: primerProducts },
      { label: 'Ceilings default paint', key: 'ceiling_paint_id', options: paintProducts },
      { label: 'Ceilings default primer', key: 'ceiling_primer_id', options: primerProducts },
      { label: 'Trim default paint', key: 'trim_paint_id', options: paintProducts },
      { label: 'Trim default primer', key: 'trim_primer_id', options: primerProducts },
    ] as const
  }, [resource.data.products])

  const validation = validateQuoteDefaults(resource.data.settings)
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

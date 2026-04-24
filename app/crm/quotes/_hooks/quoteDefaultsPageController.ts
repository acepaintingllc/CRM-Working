'use client'

import { useEditableResource } from '@/app/crm/_hooks/useEditableResource'
import { loadQuoteDefaults, loadQuoteProducts, saveQuoteDefaults } from '@/lib/quotes/client'
import {
  areQuoteDefaultsEqual,
  normalizeQuoteDefaults,
  validateQuoteDefaults,
} from '@/lib/quotes/defaultsForm'
import type { QuoteDefaults } from '@/lib/settings/types'

export type QuoteDefaultsProductRow = {
  id: string
  name: string
  family?: string | null
  status?: string | null
  missing?: boolean
}

export type QuoteDefaultsResource = {
  settings: QuoteDefaults
  products: QuoteDefaultsProductRow[]
}

const emptyQuoteDefaultsResource: QuoteDefaultsResource = {
  settings: normalizeQuoteDefaults(),
  products: [],
}

async function loadQuoteDefaultsResource(): Promise<QuoteDefaultsResource> {
  const [products, settings] = await Promise.all([
    loadQuoteProducts<QuoteDefaultsProductRow[]>({ status: 'all' }),
    loadQuoteDefaults(),
  ])

  return {
    settings: normalizeQuoteDefaults(settings),
    products,
  }
}

async function saveQuoteDefaultsResource(
  current: QuoteDefaultsResource
): Promise<{ data: QuoteDefaultsResource; notice: string }> {
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
}

function getQuoteDefaultsPageErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Failed to save quote defaults.'
}

function getQuoteDefaultsResourceIsDirty(
  current: QuoteDefaultsResource,
  snapshot: QuoteDefaultsResource
) {
  return !areQuoteDefaultsEqual(current.settings, snapshot.settings)
}

export function useQuoteDefaultsPageController() {
  const resource = useEditableResource({
    initialData: emptyQuoteDefaultsResource,
    load: loadQuoteDefaultsResource,
    save: saveQuoteDefaultsResource,
    getErrorMessage: getQuoteDefaultsPageErrorMessage,
    isDirty: getQuoteDefaultsResourceIsDirty,
  })

  return {
    resource,
    actions: {
      reload: resource.reload,
      save: resource.saveChanges,
      setSettings: (next: QuoteDefaults) =>
        resource.setData((current) => ({ ...current, settings: next })),
    },
  }
}

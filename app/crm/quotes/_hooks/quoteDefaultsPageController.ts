'use client'

import { useEditableResource } from '@/app/crm/_hooks/useEditableResource'
import { loadQuoteDefaults, loadQuoteProducts, saveQuoteDefaults } from '@/lib/quotes/client'
import {
  areQuoteDefaultsEqual,
  buildQuoteDefaultsFormState,
  type QuoteDefaultsFormState,
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
  form: QuoteDefaultsFormState<QuoteDefaultsProductRow>
}

function buildQuoteDefaultsResource(
  settings: Partial<QuoteDefaults> | null | undefined,
  products: QuoteDefaultsProductRow[]
): QuoteDefaultsResource {
  const form = buildQuoteDefaultsFormState(settings, { products })

  return {
    settings: form.settings,
    products,
    form,
  }
}

const emptyQuoteDefaultsResource = buildQuoteDefaultsResource(null, [])

async function loadQuoteDefaultsResource(): Promise<QuoteDefaultsResource> {
  const [products, settings] = await Promise.all([
    loadQuoteProducts<QuoteDefaultsProductRow[]>({ status: 'all' }),
    loadQuoteDefaults(),
  ])

  return buildQuoteDefaultsResource(settings, products)
}

async function saveQuoteDefaultsResource(
  current: QuoteDefaultsResource
): Promise<{ data: QuoteDefaultsResource; notice: string }> {
  const form = buildQuoteDefaultsFormState(current.settings, { products: current.products })
  if (!form.validation.ok) {
    throw new Error(form.validation.error)
  }

  const result = await saveQuoteDefaults(form.validation.value)

  return {
    data: buildQuoteDefaultsResource(result.data ?? form.settings, current.products),
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
        resource.setData((current) => buildQuoteDefaultsResource(next, current.products)),
    },
  }
}

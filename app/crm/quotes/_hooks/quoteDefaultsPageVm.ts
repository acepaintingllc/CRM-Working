'use client'

import { buildQuoteAdminPageStatus } from '@/app/crm/quotes/_hooks/quoteAdminPageFeedback'
import {
  quoteDefaultsProductFields,
  validateQuoteDefaults,
  type QuoteDefaultsProductFieldKey,
  type QuoteDefaultsValidationFields,
} from '@/lib/quotes/defaultsForm'
import type { QuoteDefaults } from '@/lib/settings/types'
import type { QuoteDefaultsProductRow, QuoteDefaultsResource } from './quoteDefaultsPageController'

export type QuoteDefaultsProductDefaultField = {
  label: string
  key: QuoteDefaultsProductFieldKey
  expectedFamily: string
  options: QuoteDefaultsProductRow[]
}

export type QuoteDefaultsPageVm = {
  feedback: {
    loading: boolean
    loadError: string | null
    actionError: string | null
    validationError: string | null
    notice: string | null
    noticeTone: ReturnType<typeof buildQuoteAdminPageStatus>['noticeTone']
    pageBanner: ReturnType<typeof buildQuoteAdminPageStatus>['pageBanner']
    inlineValidation: string | null
    hasLoaded: boolean
    saving: boolean
  }
  form: {
    settings: QuoteDefaults
    productDefaultFields: QuoteDefaultsProductDefaultField[]
    productDefaultErrors: QuoteDefaultsValidationFields
    validationError: string | null
    canSave: boolean
  }
}

type QuoteDefaultsPageVmResource = {
  data: QuoteDefaultsResource
  loading: boolean
  saving: boolean
  error: string | null
  notice: string | null
  dirty: boolean
  hasLoaded: boolean
}

export function buildQuoteDefaultsPageVm(resource: QuoteDefaultsPageVmResource): QuoteDefaultsPageVm {
  const validation = validateQuoteDefaults(resource.data.settings, {
    products: resource.data.products,
  })
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

  return {
    feedback: {
      ...status,
      hasLoaded: resource.hasLoaded,
      saving: resource.saving,
    },
    form: {
      settings: resource.data.settings,
      productDefaultFields: buildQuoteDefaultProductFields(
        resource.data.products,
        resource.data.settings
      ),
      productDefaultErrors: validation.fields,
      validationError: status.inlineValidation,
      canSave,
    },
  }
}

function buildQuoteDefaultProductFields(
  products: QuoteDefaultsProductRow[],
  settings: QuoteDefaults
): QuoteDefaultsProductDefaultField[] {
  return quoteDefaultsProductFields.map((field) => ({
    ...field,
    options: buildProductOptionsForDefaultField(
      products,
      settings[field.key],
      field.expectedFamily
    ),
  }))
}

function buildProductOptionsForDefaultField(
  products: QuoteDefaultsProductRow[],
  selectedProductId: string | null,
  expectedFamily: string
) {
  const activeOptions = products.filter(
    (product) => productMatchesFamily(product, expectedFamily) && productIsActive(product)
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

function productMatchesFamily(product: QuoteDefaultsProductRow, expectedFamily: string) {
  return String(product.family ?? '').trim().toLowerCase() === expectedFamily.toLowerCase()
}

function productIsActive(product: QuoteDefaultsProductRow) {
  if (product.status == null) return true
  return String(product.status).trim().toLowerCase() === 'active'
}

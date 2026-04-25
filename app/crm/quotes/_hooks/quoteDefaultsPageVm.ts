'use client'

import { buildQuoteAdminPageStatus } from '@/app/crm/quotes/_hooks/quoteAdminPageFeedback'
import type {
  QuoteDefaultsFormSectionKey,
  QuoteDefaultsFormSectionKind,
  QuoteDefaultsProductFieldKey,
  QuoteDefaultsValidationFields,
} from '@/lib/quotes/defaultsForm'
import {
  formatQuoteDefaultsProductOptionLabel,
  quoteDefaultsFormSections,
} from '@/lib/quotes/defaultsForm'
import type { QuoteDefaults } from '@/lib/settings/types'
import type { QuoteDefaultsProductRow, QuoteDefaultsResource } from './quoteDefaultsPageController'

export type QuoteDefaultsProductDefaultOption = QuoteDefaultsProductRow & {
  label: string
}

export type QuoteDefaultsProductDefaultField = {
  label: string
  key: QuoteDefaultsProductFieldKey
  expectedFamily: string
  error?: string
  options: QuoteDefaultsProductDefaultOption[]
}

export type QuoteDefaultsLaborRateField = {
  label: string
  key: 'override_labor_rate'
  error?: string
}

export type QuoteDefaultsFormSectionVm =
  | {
      key: QuoteDefaultsFormSectionKey
      kind: Extract<QuoteDefaultsFormSectionKind, 'product_defaults'>
      title: string
      description: string
      productDefaultFields: QuoteDefaultsProductDefaultField[]
    }
  | {
      key: QuoteDefaultsFormSectionKey
      kind: Extract<QuoteDefaultsFormSectionKind, 'labor_rate'>
      title: string
      description: string
      laborRateField: QuoteDefaultsLaborRateField
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
    sections: QuoteDefaultsFormSectionVm[]
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
  const validationError = resource.data.form.validationError
  const canSave = resource.hasLoaded && resource.dirty && !resource.saving && resource.data.form.canSave
  const productDefaultFields = buildProductDefaultFields(resource.data)
  const sections = buildQuoteDefaultsFormSections(
    productDefaultFields,
    resource.data.form.fieldErrors
  )
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
      sections,
      productDefaultFields,
      productDefaultErrors: resource.data.form.fieldErrors,
      validationError: status.inlineValidation,
      canSave,
    },
  }
}

function buildProductDefaultFields(
  data: QuoteDefaultsResource
): QuoteDefaultsProductDefaultField[] {
  return data.form.productDefaultFields.map((field) => ({
    ...field,
    error: data.form.fieldErrors[field.key],
    options: field.options.map((product) => ({
      ...product,
      label: formatQuoteDefaultsProductOptionLabel(product, field.expectedFamily),
    })),
  }))
}

function buildQuoteDefaultsFormSections(
  productDefaultFields: QuoteDefaultsProductDefaultField[],
  fieldErrors: QuoteDefaultsValidationFields
): QuoteDefaultsFormSectionVm[] {
  return quoteDefaultsFormSections.map((section) => {
    if (section.kind === 'product_defaults') {
      return {
        ...section,
        productDefaultFields,
      }
    }

    return {
      ...section,
      laborRateField: {
        label: 'Labor rate / hr',
        key: 'override_labor_rate',
        error: fieldErrors.override_labor_rate,
      },
    }
  })
}

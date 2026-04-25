'use client'

import { buildQuoteAdminPageStatus } from '@/app/crm/quotes/_hooks/quoteAdminPageFeedback'
import type {
  QuoteDefaultsFormSectionKind,
  QuoteDefaultsFormSectionKey,
  QuoteDefaultsFormFieldConfig,
  QuoteDefaultsProductFieldKey,
  QuoteDefaultsValidationFields,
} from '@/lib/quotes/defaultsForm'
import { formatQuoteDefaultsProductOptionLabel } from '@/lib/quotes/defaultsForm'
import type { QuoteDefaults } from '@/lib/settings/types'
import type { QuoteDefaultsProductRow, QuoteDefaultsResource } from './quoteDefaultsPageController'

export type QuoteDefaultsProductDefaultOption = QuoteDefaultsProductRow & {
  label: string
}

export type QuoteDefaultsProductDefaultField = {
  kind: 'product_select'
  label: string
  key: QuoteDefaultsProductFieldKey
  expectedFamily: string
  error?: string
  options: QuoteDefaultsProductDefaultOption[]
}

export type QuoteDefaultsLaborRateField = {
  kind: 'number_input'
  label: string
  key: 'override_labor_rate'
  min: number
  max: number
  step: number
  error?: string
}

export type QuoteDefaultsFormFieldVm =
  | QuoteDefaultsProductDefaultField
  | QuoteDefaultsLaborRateField

export type QuoteDefaultsFormSectionVm = {
  key: QuoteDefaultsFormSectionKey
  kind: QuoteDefaultsFormSectionKind
  title: string
  description: string
  fields: QuoteDefaultsFormFieldVm[]
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
  const sections = buildQuoteDefaultsFormSections(resource.data)
  const productDefaultFields = sections
    .flatMap((section) => section.fields)
    .filter((field): field is QuoteDefaultsProductDefaultField => field.kind === 'product_select')
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

function buildQuoteDefaultsFormSections(
  data: QuoteDefaultsResource
): QuoteDefaultsFormSectionVm[] {
  return data.form.sections.map(({ fieldKeys: _fieldKeys, fields, ...section }) => ({
    ...section,
    fields: fields.map((field) => buildQuoteDefaultsFormField(field, data.form.fieldErrors)),
  }))
}

function buildQuoteDefaultsFormField(
  field: QuoteDefaultsFormFieldConfig<QuoteDefaultsProductRow>,
  fieldErrors: QuoteDefaultsValidationFields
): QuoteDefaultsFormFieldVm {
  if (field.kind === 'product_select') {
    return {
      ...field,
      error: fieldErrors[field.key],
      options: field.options.map((product) => ({
        ...product,
        label: formatQuoteDefaultsProductOptionLabel(product, field.expectedFamily),
      })),
    }
  }

  return {
    ...field,
    error: fieldErrors[field.key],
  }
}

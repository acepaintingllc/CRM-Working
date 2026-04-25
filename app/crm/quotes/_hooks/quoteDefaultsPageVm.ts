'use client'

import { buildQuoteAdminPageStatus } from '@/app/crm/quotes/_hooks/quoteAdminPageFeedback'
import type {
  QuoteDefaultsProductFieldKey,
  QuoteDefaultsValidationFields,
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
  const validationError = resource.data.form.validationError
  const canSave = resource.hasLoaded && resource.dirty && !resource.saving && resource.data.form.canSave
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
      productDefaultFields: resource.data.form.productDefaultFields,
      productDefaultErrors: resource.data.form.fieldErrors,
      validationError: status.inlineValidation,
      canSave,
    },
  }
}

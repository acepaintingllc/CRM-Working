'use client'

import {
  buildQuoteAdminPageFeedback,
  type QuoteAdminPageBanner,
} from '@/app/crm/quotes/_hooks/quoteAdminPageFeedback'

type BuildDenseQuotePageUiStateArgs = {
  loading: boolean
  hasData: boolean
  loadError: string | null
  actionError: string | null
  validationError: string | null
  notice: string | null
  canRetry: boolean
  canSave: boolean
  canDelete?: boolean
  canArchiveToggle?: boolean
  canDuplicate?: boolean
}

export type DenseQuotePageUiState = {
  loading: boolean
  hasData: boolean
  loadError: string | null
  actionError: string | null
  validationError: string | null
  notice: string | null
  pageBanner: QuoteAdminPageBanner | null
  inlineValidation: string | null
  canRetry: boolean
  canSave: boolean
  canDelete: boolean
  canArchiveToggle: boolean
  canDuplicate: boolean
}

export function buildDenseQuotePageUiState({
  loading,
  hasData,
  loadError,
  actionError,
  validationError,
  notice,
  canRetry,
  canSave,
  canDelete = false,
  canArchiveToggle = false,
  canDuplicate = false,
}: BuildDenseQuotePageUiStateArgs): DenseQuotePageUiState {
  const feedback = buildQuoteAdminPageFeedback({
    loading,
    loadError,
    actionError,
    validationError,
    notice,
  })

  return {
    loading,
    hasData,
    loadError,
    actionError,
    validationError,
    notice,
    pageBanner: feedback.pageBanner,
    inlineValidation: feedback.inlineValidation,
    canRetry,
    canSave,
    canDelete,
    canArchiveToggle,
    canDuplicate,
  }
}

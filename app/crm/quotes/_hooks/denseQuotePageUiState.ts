'use client'

import {
  buildQuoteAdminPageStatus,
  type QuoteAdminPageStatus,
} from '@/app/crm/quotes/_hooks/quoteAdminPageFeedback'

type BuildDenseQuotePageUiStateArgs = {
  loading: boolean
  hasData: boolean
  loadError: string | null
  actionError: string | null
  validationError: string | null
  notice: string | null
  noticeTone?: 'success' | 'warning' | 'info' | 'error' | null
  canRetry: boolean
  canSave: boolean
  canDelete?: boolean
  canArchiveToggle?: boolean
  canDuplicate?: boolean
}

export type DenseQuotePageUiState = QuoteAdminPageStatus & {
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
  noticeTone,
  canRetry,
  canSave,
  canDelete = false,
  canArchiveToggle = false,
  canDuplicate = false,
}: BuildDenseQuotePageUiStateArgs): DenseQuotePageUiState {
  const status = buildQuoteAdminPageStatus({
    loading,
    hasData,
    loadError,
    actionError,
    validationError,
    notice,
    noticeTone,
    canRetry,
  })

  return {
    ...status,
    canSave,
    canDelete,
    canArchiveToggle,
    canDuplicate,
  }
}

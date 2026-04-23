'use client'

import type { ComponentProps } from 'react'
import type { CrmNotice } from '@/app/crm/_components/CrmNotice'

type CrmNoticeTone = ComponentProps<typeof CrmNotice>['tone']

type DenseQuotePageBanner = {
  tone: CrmNoticeTone
  message: string
}

type BuildDenseQuotePageUiStateArgs = {
  loading: boolean
  hasData: boolean
  loadError: string | null
  actionError: string | null
  validationError: string | null
  notice: string | null
  noticeTone?: CrmNoticeTone | null
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
  pageBanner: DenseQuotePageBanner | null
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
  noticeTone = 'success',
  canRetry,
  canSave,
  canDelete = false,
  canArchiveToggle = false,
  canDuplicate = false,
}: BuildDenseQuotePageUiStateArgs): DenseQuotePageUiState {
  const pageBanner = loadError
    ? { tone: 'error' as const, message: loadError }
    : actionError
      ? { tone: 'error' as const, message: actionError }
      : validationError
        ? null
        : notice
          ? { tone: noticeTone ?? 'success', message: notice }
          : null

  return {
    loading,
    hasData,
    loadError,
    actionError,
    validationError,
    notice,
    pageBanner,
    inlineValidation: loadError || actionError ? null : validationError,
    canRetry,
    canSave,
    canDelete,
    canArchiveToggle,
    canDuplicate,
  }
}

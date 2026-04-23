'use client'

import type { ComponentProps } from 'react'
import type { CrmNotice } from '@/app/crm/_components/CrmNotice'

type CrmNoticeTone = ComponentProps<typeof CrmNotice>['tone']

export type QuoteAdminPageBanner = {
  tone: CrmNoticeTone
  title?: string
  message: string
}

export type QuoteAdminPageFeedback = {
  loading: boolean
  loadError: string | null
  actionError: string | null
  validationError: string | null
  notice: string | null
  pageBanner: QuoteAdminPageBanner | null
  inlineValidation: string | null
}

export type QuoteAdminPageStatus = QuoteAdminPageFeedback & {
  hasData: boolean
  canRetry: boolean
}

type BuildQuoteAdminPageFeedbackArgs = {
  loading: boolean
  loadError?: string | null
  actionError?: string | null
  validationError?: string | null
  notice?: string | null
  loadErrorTitle?: string
  actionErrorTitle?: string
  noticeTitle?: string
  loadErrorTone?: CrmNoticeTone
}

export function buildQuoteAdminPageFeedback({
  loading,
  loadError = null,
  actionError = null,
  validationError = null,
  notice = null,
  loadErrorTitle,
  actionErrorTitle,
  noticeTitle,
  loadErrorTone = 'error',
}: BuildQuoteAdminPageFeedbackArgs): QuoteAdminPageFeedback {
  const pageBanner = loadError
    ? { tone: loadErrorTone, title: loadErrorTitle, message: loadError }
    : actionError
      ? { tone: 'error' as const, title: actionErrorTitle, message: actionError }
      : validationError
        ? null
        : notice
          ? { tone: 'success' as const, title: noticeTitle, message: notice }
          : null

  return {
    loading,
    loadError,
    actionError,
    validationError,
    notice,
    pageBanner,
    inlineValidation: loadError || actionError ? null : validationError,
  }
}

type BuildQuoteAdminPageStatusArgs = BuildQuoteAdminPageFeedbackArgs & {
  hasData: boolean
  canRetry: boolean
}

export function buildQuoteAdminPageStatus({
  hasData,
  canRetry,
  ...feedbackArgs
}: BuildQuoteAdminPageStatusArgs): QuoteAdminPageStatus {
  return {
    ...buildQuoteAdminPageFeedback(feedbackArgs),
    hasData,
    canRetry,
  }
}

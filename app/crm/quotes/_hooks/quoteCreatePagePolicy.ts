'use client'

import type {
  QuoteCreateJobContextReadModel,
  QuoteCreateJobReadModel,
} from '@/lib/quotes/quoteHomeTypes'
import {
  isEligibleQuoteVersionJob,
  type EligibleQuoteVersionJob,
} from '@/lib/quotes/versionCreation'

export type QuoteCreatePageJob = EligibleQuoteVersionJob<QuoteCreateJobReadModel>

export type QuoteCreatePageResource = {
  job: QuoteCreateJobReadModel | null
  selectedJob: QuoteCreatePageJob | null
}

export const EMPTY_QUOTE_CREATE_RESOURCE: QuoteCreatePageResource = {
  job: null,
  selectedJob: null,
}

export function buildQuoteCreatePageResource(
  context: QuoteCreateJobContextReadModel
): QuoteCreatePageResource {
  const jobPayload = context.job

  return {
    job: jobPayload,
    selectedJob:
      jobPayload.eligibility.eligible && isEligibleQuoteVersionJob(jobPayload)
        ? jobPayload
        : null,
  }
}

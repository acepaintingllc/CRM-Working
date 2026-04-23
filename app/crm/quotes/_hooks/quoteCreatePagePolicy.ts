'use client'

import type { JobDetail } from '@/lib/jobs/client'
import {
  isEligibleQuoteVersionJob,
  type EligibleQuoteVersionJob,
} from '@/lib/quotes/versionCreation'

export type QuoteCreatePageJob = EligibleQuoteVersionJob<JobDetail>

export type QuoteCreatePageResource = {
  job: QuoteCreatePageJob | null
}

export const EMPTY_QUOTE_CREATE_RESOURCE: QuoteCreatePageResource = {
  job: null,
}

export function buildQuoteCreatePageResource(jobPayload: JobDetail): QuoteCreatePageResource {
  return {
    job: isEligibleQuoteVersionJob(jobPayload) ? jobPayload : null,
  }
}

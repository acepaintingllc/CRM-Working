'use client'

import type {
  QuoteHomeJobVersionItemReadModel,
  QuoteJobVersionsReadModel,
} from '@/lib/quotes/collectionData'
import type { JobDetail } from '@/lib/jobs/client'
import {
  isEligibleQuoteVersionJob,
  type EligibleQuoteVersionJob,
} from '@/lib/quotes/versionCreation'

export type QuoteCreatePageJob = EligibleQuoteVersionJob<JobDetail>

export type QuoteCreatePageResource = {
  job: QuoteCreatePageJob | null
  versions: QuoteHomeJobVersionItemReadModel[]
}

export const EMPTY_QUOTE_CREATE_RESOURCE: QuoteCreatePageResource = {
  job: null,
  versions: [],
}

export function buildQuoteCreatePageResource(
  jobPayload: JobDetail,
  versionsPayload: QuoteJobVersionsReadModel
): QuoteCreatePageResource {
  return {
    job: isEligibleQuoteVersionJob(jobPayload) ? jobPayload : null,
    versions: versionsPayload.items,
  }
}

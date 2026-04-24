'use client'

import { buildQuoteAdminPageStatus } from '@/app/crm/quotes/_hooks/quoteAdminPageFeedback'
import type { QuoteCreateJobReadModel, QuoteHomeJobVersionItemReadModel } from '@/lib/quotes/collectionData'
import type { QuoteVersionKind } from '@/lib/quotes/versionCreation'
import { QUOTE_META_SEPARATOR } from '../_home/quoteHomePresentation'
import type { QuoteCreatePageResource } from './quoteCreatePagePolicy'

type QuoteCreatePageVmResource = {
  data: QuoteCreatePageResource
  loading: boolean
  error: string | null
}

type QuoteCreatePageVmWorkflow = {
  versions: {
    items: QuoteHomeJobVersionItemReadModel[]
    loading: boolean
    error: string | null
  }
  create: {
    error: string | null
    versionName: string
    versionKind: QuoteVersionKind
    creating: boolean
    canCreate: boolean
  }
}

export type QuoteCreatePageVm = {
  feedback: ReturnType<typeof buildQuoteAdminPageStatus> & {
    hasLoadedJobData: boolean
    shouldLoadJobData: boolean
  }
  job: {
    jobId: string
    title: string
    customerLine: string | null
    jobHref: string | null
    hasJob: boolean
    isEligible: boolean
  }
  versions: {
    items: QuoteHomeJobVersionItemReadModel[]
    hasVersions: boolean
  }
  create: {
    versionName: string
    versionKind: QuoteVersionKind
    creating: boolean
    canCreate: boolean
  }
}

type BuildQuoteCreatePageVmParams = {
  jobId: string
  shouldLoadJobData: boolean
  resource: QuoteCreatePageVmResource
  workflow: QuoteCreatePageVmWorkflow
}

export function buildQuoteCreatePageVm({
  jobId,
  shouldLoadJobData,
  resource,
  workflow,
}: BuildQuoteCreatePageVmParams): QuoteCreatePageVm {
  const jobContext = resource.data.job
  const selectedJob = resource.data.selectedJob
  const jobVersions = workflow.versions.items
  const hasLoadedJobData = shouldLoadJobData && (Boolean(jobContext) || jobVersions.length > 0)
  const loadError = resource.error ?? workflow.versions.error
  const loading = shouldLoadJobData && !loadError && (resource.loading || workflow.versions.loading)
  const status = buildQuoteAdminPageStatus({
    loading,
    hasData: hasLoadedJobData,
    loadError,
    actionError: workflow.create.error,
    canRetry: shouldLoadJobData && !loading,
  })

  return {
    feedback: {
      ...status,
      hasLoadedJobData,
      shouldLoadJobData,
    },
    job: buildQuoteCreateJobVm({
      jobId,
      jobContext,
      loading: resource.loading,
      selectedJob,
      shouldLoadJobData,
    }),
    versions: {
      items: jobVersions,
      hasVersions: jobVersions.length > 0,
    },
    create: {
      versionName: workflow.create.versionName,
      versionKind: workflow.create.versionKind,
      creating: workflow.create.creating,
      canCreate: workflow.create.canCreate,
    },
  }
}

function buildQuoteCreateJobVm({
  jobId,
  jobContext,
  loading,
  selectedJob,
  shouldLoadJobData,
}: {
  jobId: string
  jobContext: QuoteCreateJobReadModel | null
  loading: boolean
  selectedJob: QuoteCreatePageResource['selectedJob']
  shouldLoadJobData: boolean
}): QuoteCreatePageVm['job'] {
  return {
    jobId,
    title: loading && shouldLoadJobData ? '...' : jobContext?.title ?? 'Unknown job',
    customerLine: jobContext
      ? `${jobContext.customer_name ?? 'No customer assigned'}${
          jobContext.customer_address ? `${QUOTE_META_SEPARATOR}${jobContext.customer_address}` : ''
        }`
      : null,
    jobHref: jobContext ? `/crm/jobs/${jobContext.id}` : null,
    hasJob: Boolean(jobContext),
    isEligible: Boolean(selectedJob),
  }
}

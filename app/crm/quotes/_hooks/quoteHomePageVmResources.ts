import type {
  QuoteHomeBootstrapReadModel,
  QuoteHomeJobListItemReadModel,
  QuoteHomeJobVersionItemReadModel,
  QuoteHomeSearchResultReadModel,
} from '@/lib/quotes/collectionData'
import type { QuoteVersionKind } from '@/lib/quotes/versionCreation'
import type { QuoteHomePageVmResources } from '../_home/quoteHomePageVm'

export type QuoteHomeVmHomeResource = {
  summary: QuoteHomeBootstrapReadModel['summary']
  jobs: QuoteHomeJobListItemReadModel[]
  hasMore: boolean
  jobsLoading: boolean
  loading: boolean
  bootstrapError: string | null
}

export type QuoteHomeVmSearchResource = {
  loading: boolean
  emptyMessage: string | null
  error: string | null
  canRetry: boolean
  results: Pick<
    QuoteHomeSearchResultReadModel,
    'estimate_id' | 'version_name' | 'version_state' | 'job_title' | 'customer_name'
  >[]
}

export type QuoteHomeVmWorkflowResource = {
  versions: {
    items: QuoteHomeJobVersionItemReadModel[]
    error: string | null
    pageData: {
      total_versions: number
    }
    hasMore: boolean
    loadingMore: boolean
    hasResolved: boolean
  }
  create: {
    creating: boolean
    error: string | null
    versionName: string
    versionKind: QuoteVersionKind
    canCreate: boolean
  }
}

export type QuoteHomeVmDeleteResource = {
  confirmingDelete: QuoteHomeJobVersionItemReadModel | null
  deletingId: string | null
  error: string | null
}

export function buildQuoteHomePageVmResources(params: {
  homeResource: QuoteHomeVmHomeResource
  searchState: QuoteHomeVmSearchResource
  workflow: QuoteHomeVmWorkflowResource
  deleteController: QuoteHomeVmDeleteResource
}): QuoteHomePageVmResources {
  return {
    home: {
      summary: params.homeResource.summary,
      jobs: params.homeResource.jobs,
      hasMore: params.homeResource.hasMore,
      jobsLoading: params.homeResource.jobsLoading,
      loading: params.homeResource.loading,
      bootstrapError: params.homeResource.bootstrapError,
    },
    search: {
      loading: params.searchState.loading,
      emptyMessage: params.searchState.emptyMessage,
      error: params.searchState.error,
      canRetry: params.searchState.canRetry,
      results: params.searchState.results,
    },
    workflow: {
      versions: {
        items: params.workflow.versions.items,
        error: params.workflow.versions.error,
        totalVersions: params.workflow.versions.pageData.total_versions,
        hasMore: params.workflow.versions.hasMore,
        loadingMore: params.workflow.versions.loadingMore,
        hasResolved: params.workflow.versions.hasResolved,
      },
      create: {
        creating: params.workflow.create.creating,
        error: params.workflow.create.error,
        versionName: params.workflow.create.versionName,
        versionKind: params.workflow.create.versionKind,
        canCreate: params.workflow.create.canCreate,
      },
    },
    delete: {
      confirmingDelete: params.deleteController.confirmingDelete,
      deletingId: params.deleteController.deletingId,
      error: params.deleteController.error,
    },
  }
}

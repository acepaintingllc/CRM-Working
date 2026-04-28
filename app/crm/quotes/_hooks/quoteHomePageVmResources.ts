import type {
  QuoteHomeBootstrapReadModel,
  QuoteHomeJobListItemReadModel,
  QuoteHomeJobVersionItemReadModel,
  QuoteHomeSearchResultReadModel,
} from '@/lib/quotes/quoteHomeTypes'
import type { QuoteVersionKind } from '@/lib/quotes/versionCreation'
import type { QuoteHomePageVmResources } from '../_home/quoteHomePageVm'
import type { QuoteHomeDeleteState } from './useQuotesHomeDelete'
import type { QuoteHomeDataResourceContract } from './useQuotesHomeData'
import type { QuoteVersionWorkflowController } from './useQuoteVersionWorkflow'

export type QuoteHomeVmHomeResource = QuoteHomePageVmResources['home']

export type QuoteHomeVmSearchResource = QuoteHomePageVmResources['search']

export type QuoteHomeVmVersionsResource =
  QuoteHomePageVmResources['workflow']['versions']

export type QuoteHomeVmCreateResource =
  QuoteHomePageVmResources['workflow']['create']

export type QuoteHomeVmDeleteResource = QuoteHomePageVmResources['delete']

export type QuoteHomeVmHomeResourceInput = {
  summary: QuoteHomeBootstrapReadModel['summary']
  latestVersion: QuoteHomeBootstrapReadModel['latest_version']
  jobs: QuoteHomeJobListItemReadModel[]
  hasMore: boolean
  jobsLoading: boolean
  loading: boolean
  bootstrapError: string | null
  jobsError: string | null
}

export type QuoteHomeVmSearchResourceInput = {
  query: string
  loading: boolean
  error: string | null
  results: Pick<
    QuoteHomeSearchResultReadModel,
    'estimate_id' | 'version_name' | 'version_state' | 'job_title' | 'customer_name'
  >[]
}

export type QuoteHomeVmVersionsResourceInput = {
  items: QuoteHomeJobVersionItemReadModel[]
  error: string | null
  totalVersions: number
  hasMore: boolean
  loadingMore: boolean
  hasResolved: boolean
}

export type QuoteHomeVmCreateResourceInput = {
  creating: boolean
  error: string | null
  versionName: string
  versionKind: QuoteVersionKind
  canCreate: boolean
}

export type QuoteHomeVmDeleteResourceInput = {
  confirmingDelete: QuoteHomeJobVersionItemReadModel | null
  deletingId: string | null
  error: string | null
}

export type QuoteHomeSearchResourceContract = {
  query: string
  loading: boolean
  error: string | null
  results: QuoteHomeVmSearchResourceInput['results']
  retry: () => void
}

export type QuoteHomeCreateResourceContract = Pick<
  QuoteVersionWorkflowController['create'],
  'creating' | 'error' | 'versionName' | 'versionKind' | 'canCreate'
>

export type QuoteHomeDeleteResourceContract = Pick<
  QuoteHomeDeleteState,
  'confirmingDelete' | 'deletingId' | 'error'
>

export type QuoteHomeVmResourceSourceContracts = {
  homeResource: QuoteHomeDataResourceContract
  searchResource: QuoteHomeSearchResourceContract
  versionsResource: QuoteVersionWorkflowController['versions']
  createResource: QuoteHomeCreateResourceContract
  deleteResource: QuoteHomeDeleteResourceContract
}

export type QuoteHomeVmResourceInputs = {
  home: QuoteHomeVmHomeResourceInput
  search: QuoteHomeVmSearchResourceInput
  versions: QuoteHomeVmVersionsResourceInput
  create: QuoteHomeVmCreateResourceInput
  delete: QuoteHomeVmDeleteResourceInput
}

export function buildQuoteHomePageVmResourceInputs({
  homeResource,
  searchResource,
  versionsResource,
  createResource,
  deleteResource,
}: QuoteHomeVmResourceSourceContracts): QuoteHomeVmResourceInputs {
  return {
    home: {
      summary: homeResource.summary,
      latestVersion: homeResource.latestVersion,
      jobs: homeResource.jobs,
      hasMore: homeResource.hasMore,
      jobsLoading: homeResource.jobsLoading,
      loading: homeResource.loading,
      bootstrapError: homeResource.bootstrapError,
      jobsError: homeResource.jobsError,
    },
    search: {
      query: searchResource.query,
      loading: searchResource.loading,
      error: searchResource.error,
      results: searchResource.results,
    },
    versions: {
      items: versionsResource.items,
      error: versionsResource.error,
      totalVersions: versionsResource.pageData.total_versions,
      hasMore: versionsResource.hasMore,
      loadingMore: versionsResource.loadingMore,
      hasResolved: versionsResource.hasResolved,
    },
    create: {
      creating: createResource.creating,
      error: createResource.error,
      versionName: createResource.versionName,
      versionKind: createResource.versionKind,
      canCreate: createResource.canCreate,
    },
    delete: {
      confirmingDelete: deleteResource.confirmingDelete,
      deletingId: deleteResource.deletingId,
      error: deleteResource.error,
    },
  }
}

export function buildQuoteHomePageVmResources({
  home,
  search,
  versions,
  create,
  delete: deleteState,
}: QuoteHomeVmResourceInputs): QuoteHomePageVmResources {
  return {
    home: {
      summary: home.summary,
      latestVersion: home.latestVersion,
      jobs: home.jobs,
      hasMore: home.hasMore,
      jobsLoading: home.jobsLoading,
      loading: home.loading,
      bootstrapError: home.bootstrapError,
      jobsError: home.jobsError,
    },
    search: {
      query: search.query,
      loading: search.loading,
      error: search.error,
      results: search.results,
    },
    workflow: {
      versions: {
        items: versions.items,
        error: versions.error,
        totalVersions: versions.totalVersions,
        hasMore: versions.hasMore,
        loadingMore: versions.loadingMore,
        hasResolved: versions.hasResolved,
      },
      create: {
        creating: create.creating,
        error: create.error,
        versionName: create.versionName,
        versionKind: create.versionKind,
        canCreate: create.canCreate,
      },
    },
    delete: {
      confirmingDelete: deleteState.confirmingDelete,
      deletingId: deleteState.deletingId,
      error: deleteState.error,
    },
  }
}

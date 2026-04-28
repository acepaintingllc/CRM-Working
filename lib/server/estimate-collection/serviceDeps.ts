import {
  buildQuoteHomeBootstrapReadModel,
  buildQuoteHomeLatestVersionReadModel,
  buildQuoteHomeJobsPageReadModel,
  buildQuoteHomeSummaryFromRow,
  buildQuoteCreateJobContextReadModel,
  buildQuoteHomeSearchReadModel,
  buildQuoteJobVersionsReadModel,
  buildQuoteListPayload,
} from '../../quotes/quoteHomeSummary.ts'
import {
  decodeQuoteHomeCursor,
  encodeQuoteHomeCursor,
  normalizeQuoteHomePageLimit,
  normalizeQuoteHomeSearchQuery,
} from '../../quotes/quoteHomeCursors.ts'
import {
  decorateEstimateCollectionRows,
  toQuoteHomeEligibleJobReadModel,
} from '../../quotes/quoteHomeMappers.ts'
import { selectQuoteHomeSearchRows } from '../../quotes/quoteHomeSearch.ts'
import {
  createEstimateCollectionVersionRecord,
  loadEstimateCollectionJobContext,
  loadEstimateCollectionJobVersionsPage,
  loadEstimateCollectionJobsPage,
  loadEstimateCollectionRelatedRows,
  loadEstimateCollectionRowsForOrg,
  loadEstimateCollectionSummary,
  searchEstimateCollectionRows,
} from './repository.ts'

export type EstimateCollectionServiceDeps = {
  buildQuoteHomeBootstrapReadModel: typeof buildQuoteHomeBootstrapReadModel
  buildQuoteHomeLatestVersionReadModel: typeof buildQuoteHomeLatestVersionReadModel
  buildQuoteHomeJobsPageReadModel: typeof buildQuoteHomeJobsPageReadModel
  buildQuoteHomeSummaryFromRow: typeof buildQuoteHomeSummaryFromRow
  buildQuoteCreateJobContextReadModel: typeof buildQuoteCreateJobContextReadModel
  buildQuoteHomeSearchReadModel: typeof buildQuoteHomeSearchReadModel
  buildQuoteJobVersionsReadModel: typeof buildQuoteJobVersionsReadModel
  buildQuoteListPayload: typeof buildQuoteListPayload
  createEstimateCollectionVersionRecord: typeof createEstimateCollectionVersionRecord
  decodeQuoteHomeCursor: typeof decodeQuoteHomeCursor
  decorateEstimateCollectionRows: typeof decorateEstimateCollectionRows
  encodeQuoteHomeCursor: typeof encodeQuoteHomeCursor
  loadEstimateCollectionJobContext: typeof loadEstimateCollectionJobContext
  loadEstimateCollectionJobVersionsPage: typeof loadEstimateCollectionJobVersionsPage
  loadEstimateCollectionJobsPage: typeof loadEstimateCollectionJobsPage
  loadEstimateCollectionRelatedRows: typeof loadEstimateCollectionRelatedRows
  loadEstimateCollectionRowsForOrg: typeof loadEstimateCollectionRowsForOrg
  loadEstimateCollectionSummary: typeof loadEstimateCollectionSummary
  normalizeQuoteHomePageLimit: typeof normalizeQuoteHomePageLimit
  normalizeQuoteHomeSearchQuery: typeof normalizeQuoteHomeSearchQuery
  selectQuoteHomeSearchRows: typeof selectQuoteHomeSearchRows
  searchEstimateCollectionRows: typeof searchEstimateCollectionRows
  toQuoteHomeEligibleJobReadModel: typeof toQuoteHomeEligibleJobReadModel
}

const defaultDeps: EstimateCollectionServiceDeps = {
  buildQuoteHomeBootstrapReadModel,
  buildQuoteHomeLatestVersionReadModel,
  buildQuoteHomeJobsPageReadModel,
  buildQuoteHomeSummaryFromRow,
  buildQuoteCreateJobContextReadModel,
  buildQuoteHomeSearchReadModel,
  buildQuoteJobVersionsReadModel,
  buildQuoteListPayload,
  createEstimateCollectionVersionRecord,
  decodeQuoteHomeCursor,
  decorateEstimateCollectionRows,
  encodeQuoteHomeCursor,
  loadEstimateCollectionJobContext,
  loadEstimateCollectionJobVersionsPage,
  loadEstimateCollectionJobsPage,
  loadEstimateCollectionRelatedRows,
  loadEstimateCollectionRowsForOrg,
  loadEstimateCollectionSummary,
  normalizeQuoteHomePageLimit,
  normalizeQuoteHomeSearchQuery,
  selectQuoteHomeSearchRows,
  searchEstimateCollectionRows,
  toQuoteHomeEligibleJobReadModel,
}

export function withEstimateCollectionServiceDeps(
  overrides?: Partial<EstimateCollectionServiceDeps>
): EstimateCollectionServiceDeps {
  return {
    ...defaultDeps,
    ...overrides,
  }
}

import {
  buildQuoteHomeBootstrapReadModel,
  buildQuoteHomeJobsPageReadModel,
  buildQuoteHomeSummaryFromRow,
  buildQuoteCreateJobContextReadModel,
  buildQuoteHomeSearchReadModel,
  buildQuoteJobVersionsReadModel,
  buildQuoteListPayload,
  decorateEstimateCollectionRows,
  decodeQuoteHomeCursor,
  encodeQuoteHomeCursor,
  normalizeQuoteHomePageLimit,
  normalizeQuoteHomeSearchQuery,
  selectQuoteHomeSearchRows,
  toQuoteHomeEligibleJobReadModel,
} from '../../quotes/collectionData.ts'
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

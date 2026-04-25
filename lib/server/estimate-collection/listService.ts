import { okResult } from '../serviceResult'
import {
  decorateRowsForReadModel,
  loadEligibleJobsPage,
} from './serviceHelpers.ts'
import {
  withEstimateCollectionServiceDeps,
  type EstimateCollectionServiceDeps,
} from './serviceDeps.ts'

export async function loadEstimateCollectionPayload(
  orgId: string,
  deps: Partial<EstimateCollectionServiceDeps> = {}
) {
  const resolvedDeps = withEstimateCollectionServiceDeps(deps)
  const { loadEstimateCollectionRowsForOrg, buildQuoteListPayload } = resolvedDeps

  const rowsResult = await loadEstimateCollectionRowsForOrg(orgId)
  if (!rowsResult.ok) return rowsResult

  const decoratedRowsResult = await decorateRowsForReadModel(orgId, rowsResult.data, false, resolvedDeps)
  if (!decoratedRowsResult.ok) return decoratedRowsResult

  return {
    ok: true as const,
    data: buildQuoteListPayload(decoratedRowsResult.data),
  }
}

export async function loadEstimateCollectionEligibleJobs(
  orgId: string,
  deps: Partial<EstimateCollectionServiceDeps> = {}
) {
  const resolvedDeps = withEstimateCollectionServiceDeps(deps)
  const jobsResult = await loadEligibleJobsPage(orgId, { limit: 100 }, resolvedDeps)
  if (!jobsResult.ok) return jobsResult
  return okResult(jobsResult.data.items)
}

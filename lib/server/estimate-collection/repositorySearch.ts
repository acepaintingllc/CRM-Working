import { normalizeQuoteHomeSearchQuery } from '../../quotes/quoteHomeCursors.ts'
import { supabaseAdmin } from '../org.ts'
import { errorResult, okResult, type ServiceResult } from '../serviceResult.ts'
import type {
  EstimateCollectionSearchDbRows,
  EstimateCollectionVersionRow,
} from './types'
import { loadEstimateCollectionRowsByLookup } from './repositoryReads.ts'
import { escapeLikePattern, estimateSelect } from './repositoryShared.ts'

async function searchEstimateCollectionVersionRows(
  orgId: string,
  query: string,
  candidateLimit: number
) {
  const estimateSearchPattern = `%${escapeLikePattern(query.replace(/[(),]/g, ' ').trim())}%`

  const { data, error } = await supabaseAdmin
    .from('estimates')
    .select(estimateSelect)
    .eq('org_id', orgId)
    .or(
      [
        `version_name.ilike.${estimateSearchPattern}`,
        `version_kind.ilike.${estimateSearchPattern}`,
        `version_state.ilike.${estimateSearchPattern}`,
      ].join(',')
    )
    .order('updated_at', { ascending: false })
    .limit(candidateLimit)

  if (error) {
    return errorResult('server_error', error.message)
  }

  return okResult((data ?? []) as EstimateCollectionVersionRow[])
}

async function searchEstimateCollectionLookupIds(
  orgId: string,
  table: 'jobs' | 'customers',
  column: 'title' | 'name',
  query: string,
  candidateLimit: number
): Promise<ServiceResult<string[]>> {
  const pattern = `%${escapeLikePattern(query)}%`
  const { data, error } = await supabaseAdmin
    .from(table)
    .select('id')
    .eq('org_id', orgId)
    .ilike(column, pattern)
    .limit(candidateLimit)

  if (error) {
    return errorResult('server_error', error.message)
  }

  return okResult((data ?? []).map((row) => String(row.id ?? '')).filter(Boolean))
}

export async function searchEstimateCollectionRows(
  orgId: string,
  rawQuery: string,
  candidateLimit: number
): Promise<ServiceResult<EstimateCollectionSearchDbRows>> {
  const query = normalizeQuoteHomeSearchQuery(rawQuery)
  if (!query) {
    return okResult({
      query,
      candidateLimit,
      versionRows: [],
      jobRows: [],
      customerRows: [],
    })
  }

  const [versionRowsResult, jobIdsResult, customerIdsResult] = await Promise.all([
    searchEstimateCollectionVersionRows(orgId, query, candidateLimit),
    searchEstimateCollectionLookupIds(orgId, 'jobs', 'title', query, candidateLimit),
    searchEstimateCollectionLookupIds(orgId, 'customers', 'name', query, candidateLimit),
  ])

  if (!versionRowsResult.ok) return versionRowsResult
  if (!jobIdsResult.ok) return jobIdsResult
  if (!customerIdsResult.ok) return customerIdsResult

  const [jobRowsResult, customerRowsResult] = await Promise.all([
    jobIdsResult.data.length
      ? loadEstimateCollectionRowsByLookup(orgId, {
          jobIds: jobIdsResult.data,
          limit: candidateLimit,
        })
      : Promise.resolve(okResult([] as EstimateCollectionVersionRow[])),
    customerIdsResult.data.length
      ? loadEstimateCollectionRowsByLookup(orgId, {
          customerIds: customerIdsResult.data,
          limit: candidateLimit,
        })
      : Promise.resolve(okResult([] as EstimateCollectionVersionRow[])),
  ])

  if (!jobRowsResult.ok) return jobRowsResult
  if (!customerRowsResult.ok) return customerRowsResult

  return okResult({
    query,
    candidateLimit,
    versionRows: versionRowsResult.data,
    jobRows: jobRowsResult.data,
    customerRows: customerRowsResult.data,
  })
}

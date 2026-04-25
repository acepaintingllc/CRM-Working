import { serverLog } from '@/lib/server/log'
import { errorResult, okResult, type ServiceResult } from '../serviceResult'
import type {
  QuoteHomeCursorKey,
  QuoteHomeJobListItemReadModel,
} from '../../quotes/collectionData.ts'
import type {
  EstimateCollectionJobVersionsDbPage,
  EstimateCollectionVersionRow,
} from './types'
import type { EstimateCollectionServiceDeps } from './serviceDeps.ts'

export const HOME_BOOTSTRAP_JOB_LIMIT = 25
export const HOME_VERSIONS_LIMIT = 25
export const HOME_SEARCH_LIMIT = 8
export const HOME_SEARCH_CANDIDATE_LIMIT = HOME_SEARCH_LIMIT * 4

export function bytesForLog(value: unknown) {
  try {
    return JSON.stringify(value).length
  } catch {
    return -1
  }
}

export function logQuoteHomeRead(event: string, meta: Record<string, unknown>) {
  serverLog.info('[quote-home]', event, meta)
}

export async function decorateRowsForReadModel(
  orgId: string,
  rows: EstimateCollectionVersionRow[],
  includeRollups: boolean,
  deps: EstimateCollectionServiceDeps
) {
  const relationsResult = await deps.loadEstimateCollectionRelatedRows(orgId, rows, {
    includeRollups,
  })
  if (!relationsResult.ok) return relationsResult

  return {
    ok: true as const,
    data: deps.decorateEstimateCollectionRows(rows, relationsResult.data),
  }
}

export async function loadEligibleJobsPage(
  orgId: string,
  options: { query?: string; limit?: number; cursor?: string | null },
  deps: EstimateCollectionServiceDeps
) {
  const pageOptions = parseQuoteHomePageOptions(options, false, deps)
  if (!pageOptions.ok) return pageOptions

  const firstPageResult = await deps.loadEstimateCollectionJobsPage(orgId, pageOptions.data)
  if (!firstPageResult.ok) return firstPageResult

  const limit = firstPageResult.data.limit
  const query = firstPageResult.data.query
  const eligibleItems: QuoteHomeJobListItemReadModel[] = []
  let scannedRows = firstPageResult.data.rows
  let lastRawRow = scannedRows[scannedRows.length - 1] ?? null
  let hasMoreRawRows = scannedRows.length > limit

  while (true) {
    for (const row of scannedRows) {
      const item = deps.toQuoteHomeEligibleJobReadModel(row)
      if (item) {
        eligibleItems.push(item)
      }
      if (eligibleItems.length > limit) break
    }

    if (eligibleItems.length > limit || !hasMoreRawRows || !lastRawRow?.created_at) break

    const nextPageResult = await deps.loadEstimateCollectionJobsPage(orgId, {
      query,
      limit,
      cursor: {
        timestamp: lastRawRow.created_at,
        id: lastRawRow.id,
      },
    })
    if (!nextPageResult.ok) return nextPageResult

    scannedRows = nextPageResult.data.rows
    lastRawRow = scannedRows[scannedRows.length - 1] ?? null
    hasMoreRawRows = scannedRows.length > limit
  }

  const pageItems = eligibleItems.slice(0, limit)
  const lastReturnedItem = pageItems[pageItems.length - 1] ?? null
  return {
    ok: true as const,
    data: {
      query,
      limit,
      nextCursor:
        eligibleItems.length > limit && lastReturnedItem?.created_at
          ? deps.encodeQuoteHomeCursor({
              timestamp: lastReturnedItem.created_at,
              id: lastReturnedItem.id,
            })
          : null,
      items: pageItems,
    },
  }
}

export function parseQuoteHomePageOptions(
  options: { query?: string; limit?: number; cursor?: string | null },
  allowNullTimestampCursor: boolean,
  deps: EstimateCollectionServiceDeps
): ServiceResult<{
  query: string
  limit: number
  cursor: QuoteHomeCursorKey | null
}> {
  const cursorResult = deps.decodeQuoteHomeCursor(options.cursor)
  if (!cursorResult.ok) {
    return errorResult('invalid_input', cursorResult.message)
  }
  if (!allowNullTimestampCursor && cursorResult.value?.timestamp === null) {
    return errorResult('invalid_input', 'Invalid cursor.')
  }

  return okResult({
    query: deps.normalizeQuoteHomeSearchQuery(options.query),
    limit: deps.normalizeQuoteHomePageLimit(options.limit),
    cursor: cursorResult.value,
  })
}

export function buildJobVersionsPageData(
  page: EstimateCollectionJobVersionsDbPage,
  deps: EstimateCollectionServiceDeps
) {
  const items = page.rows.slice(0, page.limit)
  const lastReturnedRow = items[items.length - 1] ?? null

  return {
    jobId: page.jobId,
    totalVersions: page.totalVersions,
    limit: page.limit,
    nextCursor:
      page.rows.length > page.limit && lastReturnedRow
        ? deps.encodeQuoteHomeCursor({
            timestamp: lastReturnedRow.updated_at,
            id: lastReturnedRow.id,
          })
        : null,
    items,
  }
}

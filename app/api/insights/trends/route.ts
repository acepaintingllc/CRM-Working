import { jsonError, requireSessionUserOrg } from '@/lib/server/apiRoute'
import { readEstimateFeedbackTrendFilterRawQuery } from '@/lib/estimate-feedback/trendFilters'
import { serviceResultResponse } from '@/lib/server/routeResult'
import {
  loadEstimateFeedbackTrends,
  normalizeTrendFilters,
} from '@/lib/server/estimate-feedback/trends'

function readFilters(request: Request) {
  const url = new URL(request.url)
  return normalizeTrendFilters(readEstimateFeedbackTrendFilterRawQuery(url.searchParams))
}

export async function GET(request: Request) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const filters = readFilters(request)
  if (!filters.ok) return jsonError(filters.message, 400)

  return serviceResultResponse(
    await loadEstimateFeedbackTrends(session.session.orgId, filters.data),
    (data) => ({ data })
  )
}

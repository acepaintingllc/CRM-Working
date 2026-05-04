import { jsonError, requireSessionUserOrg } from '@/lib/server/apiRoute'
import { serviceResultResponse } from '@/lib/server/routeResult'
import {
  loadEstimateFeedbackTrends,
  normalizeTrendFilters,
} from '@/lib/server/estimate-feedback/trends'

function readFilters(request: Request) {
  const url = new URL(request.url)
  return normalizeTrendFilters({
    from:
      url.searchParams.get('from') ??
      url.searchParams.get('start') ??
      url.searchParams.get('lockedFrom'),
    to:
      url.searchParams.get('to') ??
      url.searchParams.get('end') ??
      url.searchParams.get('lockedTo'),
    jobType: url.searchParams.get('jobType') ?? url.searchParams.get('job_type'),
    occupancy: url.searchParams.get('occupancy'),
    conditionTags: [
      ...url.searchParams.getAll('conditionTag'),
      ...url.searchParams.getAll('conditionTags'),
      ...url.searchParams.getAll('condition_tag'),
      ...url.searchParams.getAll('condition_tags'),
    ],
    maxAbsoluteVariance:
      url.searchParams.get('maxAbsoluteVariance') ??
      url.searchParams.get('max_absolute_variance'),
    maxAbsoluteTotalImpact:
      url.searchParams.get('maxAbsoluteTotalImpact') ??
      url.searchParams.get('max_absolute_total_impact'),
  })
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

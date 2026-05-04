import { jsonError, readJsonBody, requireSessionUserOrg } from '@/lib/server/apiRoute'
import { serviceResultResponse } from '@/lib/server/routeResult'
import {
  generateTrendRecommendations,
  listTrendRecommendations,
  normalizeRecommendationPostInput,
  normalizeRecommendationStatus,
  updateTrendRecommendationStatus,
} from '@/lib/server/estimate-feedback/recommendations'

function readStatus(request: Request) {
  const url = new URL(request.url)
  const raw = url.searchParams.get('status')
  if (!raw) return null
  return normalizeRecommendationStatus(raw)
}

export async function GET(request: Request) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const status = readStatus(request)
  if (status && !status.ok) return jsonError(status.message, 400)

  return serviceResultResponse(
    await listTrendRecommendations(session.session.orgId, status?.data ?? null),
    (data) => ({ data })
  )
}

export async function POST(request: Request) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const body = await readJsonBody(request)
  if (!body.ok) return body.response

  const input = normalizeRecommendationPostInput(body.value)
  if (!input.ok) return jsonError(input.message, 400)

  if (input.data.action === 'update_status') {
    return serviceResultResponse(
      await updateTrendRecommendationStatus(session.session.orgId, input.data),
      (data) => ({ data, notice: 'Recommendation updated.' })
    )
  }

  return serviceResultResponse(
    await generateTrendRecommendations(session.session.orgId, input.data),
    (data) => ({ data, notice: 'Recommendations generated.' })
  )
}

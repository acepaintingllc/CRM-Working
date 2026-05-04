import {
  readUuidParam,
  requireSessionUserOrg,
  resolveParams,
} from '@/lib/server/apiRoute'
import { serviceResultResponse } from '@/lib/server/routeResult'
import { applyTrendRecommendation } from '@/lib/server/estimate-feedback/recommendations'

type RouteContext = {
  params: {
    id?: string
  } | Promise<{
    id?: string
  }>
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const params = await resolveParams(context)
  const recommendationId = readUuidParam(params.id, 'recommendation id')
  if (!recommendationId.ok) return recommendationId.response

  return serviceResultResponse(
    await applyTrendRecommendation(session.session.orgId, {
      recommendationId: recommendationId.value,
      actorId: session.session.userId,
    }),
    (data) => ({ data, notice: 'Recommendation applied.' })
  )
}

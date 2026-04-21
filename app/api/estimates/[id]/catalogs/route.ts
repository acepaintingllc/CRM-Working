import { NextResponse } from 'next/server'
import { getEstimateCatalogs } from '@/lib/server/estimateCatalogs'
import {
  jsonError,
  readUuidParam,
  requireSessionUserOrg,
  resolveParams,
} from '@/lib/server/apiRoute'

type EstimateCatalogsRouteContext = { params: { id: string } | Promise<{ id: string }> }

export async function GET(request: Request, context: EstimateCatalogsRouteContext) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const params = await resolveParams(context)
  const estimateId = readUuidParam(params?.id, 'estimate id')
  if (!estimateId.ok) return estimateId.response

  try {
    const url = new URL(request.url)
    const catalogs = await getEstimateCatalogs({
      origin: url.origin,
      orgId: auth.session.orgId,
      userId: auth.session.userId,
      estimateId: estimateId.value,
      forceRefresh: url.searchParams.get('refresh') === '1',
    })
    return NextResponse.json(catalogs)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load estimate catalogs'
    return jsonError(message, 400)
  }
}

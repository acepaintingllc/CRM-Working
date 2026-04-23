<<<<<<< Updated upstream
import { NextResponse } from 'next/server'
import { serviceResultResponse } from '@/lib/server/routeResult'
=======
import { readJsonBody, resolveParams } from '@/lib/server/apiRoute'
import { serviceErrorResponse, serviceResultDataResponse } from '@/lib/server/routeResult'
>>>>>>> Stashed changes
import { declinePublicEstimate } from '@/lib/server/estimatePublicPortal'
import { parsePublicEstimateDeclineRequest } from '@/lib/customer-estimates/publicPortalContracts'

export async function POST(
  request: Request,
  context: { params: { token: string } | Promise<{ token: string }> }
) {
  const params = await resolveParams(context)
  const token = (params as { token?: string } | null | undefined)?.token
  const body = await readJsonBody<Record<string, unknown>>(request)
  if (!body.ok) return body.response
  const parsed = parsePublicEstimateDeclineRequest(body.value)
  if (!parsed.ok) {
    return serviceErrorResponse({
      ok: false,
      kind: 'invalid_input',
      message: parsed.error,
    })
  }
<<<<<<< Updated upstream

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  return serviceResultResponse(
    await declinePublicEstimate({
      token,
      reason: asText(body?.reason),
    }),
    (version) => ({ ok: true, version })
=======
  return serviceResultDataResponse(
    await declinePublicEstimate({
      token: token ?? '',
      reason: parsed.value.reason,
    })
>>>>>>> Stashed changes
  )
}

import { readJsonBody, resolveParams } from '@/lib/server/apiRoute'
import { serviceErrorResponse, serviceResultDataResponse } from '@/lib/server/routeResult'
import { acceptPublicEstimate } from '@/lib/server/estimatePublicPortal'
import { parsePublicEstimateAcceptRequest } from '@/lib/customer-estimates/publicPortalContracts'

export async function POST(
  request: Request,
  context: { params: { token: string } | Promise<{ token: string }> }
) {
  const params = await resolveParams(context)
  const token = (params as { token?: string } | null | undefined)?.token
  const body = await readJsonBody<Record<string, unknown>>(request)
  if (!body.ok) return body.response

  const parsed = parsePublicEstimateAcceptRequest(body.value)
  if (!parsed.ok) {
    return serviceErrorResponse({
      ok: false,
      kind: 'invalid_input',
      message: parsed.error,
    })
  }

  return serviceResultDataResponse(
    await acceptPublicEstimate({
      token: token ?? '',
      legalName: parsed.value.legalName,
      signatureType: parsed.value.signatureType,
      signatureValue: parsed.value.signatureValue,
      acceptedTerms: parsed.value.acceptedTerms,
      userAgent: request.headers.get('user-agent') ?? '',
      ip: request.headers.get('x-forwarded-for') ?? '',
      origin: new URL(request.url).origin,
    })
  )
}

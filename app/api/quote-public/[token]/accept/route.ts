import { readJsonBody, resolveParams } from '@/lib/server/apiRoute'
import { serviceErrorResponse, serviceResultDataResponse } from '@/lib/server/routeResult'
import { acceptPublicEstimate } from '@/lib/server/estimatePublicPortal'
import { parsePublicEstimateAcceptRequest } from '@/lib/customer-estimates/publicPortalContracts'
import { checkLocalRateLimit } from '@/lib/server/rateLimit'
import { getClientIp } from '@/lib/server/routeUtils'

export async function POST(
  request: Request,
  context: { params: { token: string } | Promise<{ token: string }> }
) {
  const params = await resolveParams(context)
  const token = (params as { token?: string } | null | undefined)?.token

  // In-memory rate limit — best-effort on serverless (resets per instance)
  const rate = checkLocalRateLimit({ key: `quote-public:accept:${token ?? ''}`, max: 10, windowMs: 60_000 })
  if (!rate.ok) {
    return Response.json(
      { error: 'Too many requests. Please wait and retry.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) } }
    )
  }

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
      customerEmail: parsed.value.customerEmail,
      signatureType: parsed.value.signatureType,
      signatureValue: parsed.value.signatureValue,
      acceptedTerms: parsed.value.acceptedTerms,
      ...(parsed.value.customerMessage ? { customerMessage: parsed.value.customerMessage } : {}),
      origin: new URL(request.url).origin,
      userAgent: request.headers.get('user-agent') ?? '',
      ip: getClientIp(request),
    })
  )
}

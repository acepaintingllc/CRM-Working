<<<<<<< Updated upstream
import { NextResponse } from 'next/server'
import { serviceResultResponse } from '@/lib/server/routeResult'
=======
import { readJsonBody, resolveParams } from '@/lib/server/apiRoute'
import { serviceErrorResponse, serviceResultDataResponse } from '@/lib/server/routeResult'
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const legalName = asText(body?.legal_name || body?.full_name)
  const signatureType = asText(body?.signature_type) || 'typed'
  const signatureValue = asText(body?.signature_value || body?.signature)
  const accepted =
    body?.accepted_terms === true ||
    body?.accepted === true ||
    body?.agreement_checked === true

  return serviceResultResponse(
=======
  return serviceResultDataResponse(
>>>>>>> Stashed changes
    await acceptPublicEstimate({
      token: token ?? '',
      legalName: parsed.value.legalName,
      signatureType: parsed.value.signatureType,
      signatureValue: parsed.value.signatureValue,
      acceptedTerms: parsed.value.acceptedTerms,
      userAgent: request.headers.get('user-agent') ?? '',
      ip: request.headers.get('x-forwarded-for') ?? '',
    }),
    (version) => ({ ok: true, version })
  )
}

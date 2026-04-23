import { NextResponse } from 'next/server'
import { serviceResultDataResponse } from '@/lib/server/routeResult'
import { acceptPublicEstimate } from '@/lib/server/estimatePublicPortal'

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

export async function POST(
  request: Request,
  context: { params: { token: string } | Promise<{ token: string }> }
) {
  const params = await Promise.resolve(context.params)
  const token = (params as { token?: string } | null | undefined)?.token
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const legalName = asText(body?.legal_name || body?.full_name)
  const signatureType = asText(body?.signature_type) || 'typed'
  const signatureValue = asText(body?.signature_value || body?.signature)
  const accepted =
    body?.accepted_terms === true ||
    body?.accepted === true ||
    body?.agreement_checked === true

  return serviceResultDataResponse(
    await acceptPublicEstimate({
      token,
      legalName,
      signatureType,
      signatureValue,
      acceptedTerms: accepted,
      userAgent: request.headers.get('user-agent') ?? '',
      ip: request.headers.get('x-forwarded-for') ?? '',
    })
  )
}

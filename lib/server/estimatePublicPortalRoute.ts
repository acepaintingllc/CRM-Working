import { NextResponse } from 'next/server'
import { jsonError, readJsonBody, resolveParams } from '@/lib/server/apiRoute'
import { serviceResultResponse } from '@/lib/server/routeResult'
import {
  acceptPublicEstimateWorkflow,
  declinePublicEstimateWorkflow,
  loadPublicEstimateWorkflow,
  normalizePublicEstimateAcceptanceInput,
} from './estimatePublicPortalWorkflow'

export type PublicEstimateRouteContext = {
  params: { token: string } | Promise<{ token: string }>
}

async function readPublicToken(context: PublicEstimateRouteContext) {
  const params = await resolveParams(context)
  const token = (params as { token?: string } | null | undefined)?.token
  if (!token || typeof token !== 'string') {
    return { ok: false as const, response: jsonError('Invalid token', 400) }
  }
  return { ok: true as const, value: token }
}

function readPublicRequestMetadata(request: Request) {
  return {
    origin: new URL(request.url).origin,
    userAgent: request.headers.get('user-agent') ?? '',
    ip: request.headers.get('x-forwarded-for') ?? '',
  }
}

async function readPublicAcceptRequest(request: Request) {
  const body = await readJsonBody<Record<string, unknown>>(request)
  if (!body.ok) return body
  return {
    ok: true as const,
    value: normalizePublicEstimateAcceptanceInput(body.value ?? {}),
  }
}

async function readPublicDeclineRequest(request: Request) {
  const body = await readJsonBody<Record<string, unknown>>(request, { allowEmpty: true })
  if (!body.ok) return body
  return {
    ok: true as const,
    value: {
      reason:
        body.value && typeof body.value.reason === 'string' ? body.value.reason.trim() : '',
    },
  }
}

export async function handlePublicEstimateReadRoute(
  request: Request,
  context: PublicEstimateRouteContext
) {
  const token = await readPublicToken(context)
  if (!token.ok) return token.response

  const metadata = readPublicRequestMetadata(request)
  return serviceResultResponse(
    await loadPublicEstimateWorkflow({
      token: token.value,
      origin: metadata.origin,
      userAgent: metadata.userAgent,
    }),
    (snapshot) => ({ ok: true, ...snapshot })
  )
}

export async function handlePublicEstimateAcceptRoute(
  request: Request,
  context: PublicEstimateRouteContext
) {
  const token = await readPublicToken(context)
  if (!token.ok) return token.response

  const body = await readPublicAcceptRequest(request)
  if (!body.ok) return body.response

  const metadata = readPublicRequestMetadata(request)
  return serviceResultResponse(
    await acceptPublicEstimateWorkflow({
      token: token.value,
      legalName: body.value.legalName,
      signatureType: body.value.signatureType,
      signatureValue: body.value.signatureValue,
      acceptedTerms: body.value.acceptedTerms,
      userAgent: metadata.userAgent,
      ip: metadata.ip,
    }),
    (version) => ({ ok: true, version })
  )
}

export async function handlePublicEstimateDeclineRoute(
  request: Request,
  context: PublicEstimateRouteContext
) {
  const token = await readPublicToken(context)
  if (!token.ok) return token.response

  const body = await readPublicDeclineRequest(request)
  if (!body.ok) return body.response

  return serviceResultResponse(
    await declinePublicEstimateWorkflow({
      token: token.value,
      reason: body.value.reason,
    }),
    (version) => ({ ok: true, version })
  )
}


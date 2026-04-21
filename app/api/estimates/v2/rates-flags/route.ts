import { NextResponse } from 'next/server'
import {
  jsonError,
  readJsonBody,
  requireSessionUserOrg,
} from '@/lib/server/apiRoute'
import {
  applyRatesFlagsMutation,
  readRatesFlagsPayload,
} from '@/lib/server/rates-flags'
import type { RatesFlagsMutationRequest } from '@/types/estimator/ratesFlags'

export async function GET(request: Request) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  try {
    const payload = await readRatesFlagsPayload({
      origin: new URL(request.url).origin,
      orgId: auth.session.orgId,
      userId: auth.session.userId,
    })
    return NextResponse.json(payload)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load rates and flags.'
    return jsonError(message, 400)
  }
}

async function mutate(request: Request) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const body = await readJsonBody<RatesFlagsMutationRequest>(request)
  if (!body.ok) return body.response

  const payload = body.value
  if (!payload || typeof payload !== 'object') {
    return jsonError('Invalid body.', 400)
  }
  if (!payload.category || !payload.action || !payload.values) {
    return jsonError('Body must include category, action, and values.', 400)
  }

  try {
    const result = await applyRatesFlagsMutation({
      origin: new URL(request.url).origin,
      orgId: auth.session.orgId,
      userId: auth.session.userId,
      request: payload,
    })
    if (!result.ok) return jsonError(result.error, result.status)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save rates and flags.'
    return jsonError(message, 400)
  }
}

export async function PUT(request: Request) {
  return mutate(request)
}

export async function PATCH(request: Request) {
  return mutate(request)
}

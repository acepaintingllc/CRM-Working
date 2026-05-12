import {
  readJsonBody,
  readUuidParam,
  requireSessionUserOrg,
  resolveParams,
} from '@/lib/server/apiRoute'
import { checkLocalRateLimit } from '@/lib/server/rateLimit'
import { loadEstimateCustomerSendContext } from '@/lib/server/estimateCustomerPortal'
import {
  serviceResultDataResponse,
  serviceResultMutationResponse,
} from '@/lib/server/routeResult'
import {
  errorResult,
  okResult,
  type ServiceResult,
} from '@/lib/server/serviceResult'
import {
  loadCustomerSendPageData,
  saveCustomerSendDraftMutation,
  submitCustomerSendMutation,
} from './customer-send/service'
import type {
  CustomerSendCopy,
  EstimateCustomerSendContextData,
} from './customer-send/types'

export type EstimateCustomerSendRouteContext = {
  params: { id: string } | Promise<{ id: string }>
}

async function loadCustomerSendContextResult(params: {
  origin: string
  orgId: string
  userId: string
  estimateId: string
  allowPersistedArtifactPreview?: boolean
  draftSource?: Record<string, unknown> | null
  operation?: 'read' | 'save' | 'send' | 'test'
}): Promise<ServiceResult<EstimateCustomerSendContextData>> {
  const contextResult = await loadEstimateCustomerSendContext(params)
  if ('error' in contextResult) {
    return errorResult(
      contextResult.error === 'Quote not found' ? 'not_found' : 'server_error',
      contextResult.error ?? 'Quote not found'
    )
  }
  return okResult(contextResult)
}

export async function handleEstimateCustomerSendRouteGet(
  request: Request,
  context: EstimateCustomerSendRouteContext
) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const params = await resolveParams(context)
  const estimateId = readUuidParam(params?.id, 'estimate id')
  if (!estimateId.ok) return estimateId.response

  const origin = new URL(request.url).origin
  const forceLiveRefresh = new URL(request.url).searchParams.get('refresh') === '1'
  const contextResult = await loadCustomerSendContextResult({
    origin,
    orgId: auth.session.orgId,
    userId: auth.session.userId,
    estimateId: estimateId.value,
    operation: 'read',
    allowPersistedArtifactPreview: !forceLiveRefresh,
  })
  if (!contextResult.ok) return serviceResultDataResponse(contextResult)

  return serviceResultDataResponse(
    await loadCustomerSendPageData({
      origin,
      orgId: auth.session.orgId,
      userId: auth.session.userId,
      estimateId: estimateId.value,
      context: contextResult.data,
    })
  )
}

export async function handleEstimateCustomerSendRoutePut(
  request: Request,
  context: EstimateCustomerSendRouteContext
) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const params = await resolveParams(context)
  const estimateId = readUuidParam(params?.id, 'estimate id')
  if (!estimateId.ok) return estimateId.response

  const body = await readJsonBody<Record<string, unknown>>(request)
  if (!body.ok) return body.response

  const origin = new URL(request.url).origin
  const contextResult = await loadCustomerSendContextResult({
    origin,
    orgId: auth.session.orgId,
    userId: auth.session.userId,
    estimateId: estimateId.value,
    allowPersistedArtifactPreview: true,
    draftSource: body.value ?? {},
    operation: 'save',
  })
  if (!contextResult.ok) return serviceResultDataResponse(contextResult)

  return serviceResultMutationResponse(
    await saveCustomerSendDraftMutation({
      origin,
      orgId: auth.session.orgId,
      userId: auth.session.userId,
      estimateId: estimateId.value,
      body: body.value ?? {},
      context: contextResult.data,
    }),
    'Draft saved.'
  )
}

export async function handleEstimateCustomerSendRoutePost(
  request: Request,
  context: EstimateCustomerSendRouteContext,
  copy: CustomerSendCopy
) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const params = await resolveParams(context)
  const estimateId = readUuidParam(params?.id, 'estimate id')
  if (!estimateId.ok) return estimateId.response

  const body = await readJsonBody<Record<string, unknown>>(request, { allowEmpty: true })
  if (!body.ok) return body.response

  const rate = checkLocalRateLimit({
    key: `customer-send:${auth.session.orgId}:${auth.session.userId}:${estimateId.value}`,
    max: 5,
    windowMs: 10 * 60 * 1000,
  })
  if (!rate.ok) {
    return Response.json(
      { error: 'Too many send attempts. Please wait and retry.' },
      { status: 429 }
    )
  }

  const origin = new URL(request.url).origin
  const contextResult = await loadCustomerSendContextResult({
    origin,
    orgId: auth.session.orgId,
    userId: auth.session.userId,
    estimateId: estimateId.value,
    allowPersistedArtifactPreview: true,
    draftSource: body.value,
    operation: String(body.value?.mode ?? '').trim().toLowerCase() === 'test' ? 'test' : 'send',
  })
  if (!contextResult.ok) return serviceResultDataResponse(contextResult)

  return serviceResultMutationResponse(
    await submitCustomerSendMutation({
      origin,
      orgId: auth.session.orgId,
      userId: auth.session.userId,
      estimateId: estimateId.value,
      body: body.value,
      context: contextResult.data,
      copy,
    }),
    String(body.value?.mode ?? '').trim().toLowerCase() === 'test'
      ? 'Test message sent.'
      : copy.sendNotice
  )
}

export const estimateCustomerSendCopy: CustomerSendCopy = {
  sendNotice: 'Estimate sent.',
  sendFailureMessage: 'Unable to send estimate',
  lockFailureMessage: 'Unable to lock estimate',
}

export const quoteCustomerSendCopy: CustomerSendCopy = {
  sendNotice: 'Quote sent.',
  sendFailureMessage: 'Unable to send quote',
  lockFailureMessage: 'Unable to lock quote',
}

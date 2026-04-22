import { randomUUID } from 'node:crypto'
import { sendGmailMessage } from '@/lib/server/googleMail'
import {
  errorResult,
  okResult,
  type ServiceResult,
} from '@/lib/server/serviceResult'
import {
  asText,
  buildCustomerSendPublicUrl,
} from './document'
import {
  markEstimatePublicVersionSent,
  writeEstimatePublicEvent,
} from './repository'
import type {
  CustomerSendCopy,
  CustomerSendDraft,
  CustomerSendMode,
  EstimateCustomerSendContextData,
  EstimatePublicVersionRow,
} from './types'

function buildDefaultEmailBody(params: {
  draft: CustomerSendDraft
  context: EstimateCustomerSendContextData
  publicUrl: string | null
  mode: CustomerSendMode
}) {
  if (params.draft.body) return params.draft.body

  const customerName = asText(params.context.job.customer_name) || 'there'
  const signature =
    params.context.company.sender_signature ||
    `Thanks,\n${params.context.company.business_name || 'ACE Painting'}`

  if (params.publicUrl) {
    return [
      `Hello ${customerName},`,
      '',
      `Your quote is ready: ${params.publicUrl}`,
      '',
      'You can review the full quote and accept it directly from the link above.',
      '',
      signature,
    ].join('\n')
  }

  return [
    `Hello ${customerName},`,
    '',
    params.mode === 'test'
      ? 'This is a test copy of your quote email.'
      : 'Your quote is ready for review.',
    '',
    signature,
  ].join('\n')
}

export async function submitCustomerSendMessage(params: {
  mode: CustomerSendMode
  origin: string
  orgId: string
  userId: string
  draft: CustomerSendDraft
  context: EstimateCustomerSendContextData
  version: EstimatePublicVersionRow
  copy: CustomerSendCopy
}): Promise<
  ServiceResult<{
    mode: CustomerSendMode
    public_url: string | null
    version: EstimatePublicVersionRow
    document: Record<string, unknown> | null
  }>
> {
  let publicVersion = params.version
  let publicUrl = buildCustomerSendPublicUrl({
    origin: params.origin,
    version: publicVersion,
    fallback: params.context.public_url,
  })

  if (params.mode === 'send') {
    let token = asText(publicVersion.public_token)
    if (!token) token = randomUUID().replace(/-/g, '')
    const sentAt = new Date().toISOString()
    const sentVersion = await markEstimatePublicVersionSent({
      orgId: params.orgId,
      versionId: asText(publicVersion.id),
      publicToken: token,
      sentAt,
      lockFailureMessage: params.copy.lockFailureMessage,
    })
    if (!sentVersion.ok) return sentVersion

    publicVersion = sentVersion.data
    publicUrl = buildCustomerSendPublicUrl({
      origin: params.origin,
      version: publicVersion,
      fallback: params.context.public_url,
    })

    const eventResult = await writeEstimatePublicEvent({
      orgId: params.orgId,
      versionId: asText(publicVersion.id),
      eventType: 'sent',
      actorType: 'staff',
      createdBy: params.userId,
      metadata: { publicUrl },
    })
    if (!eventResult.ok) return eventResult
  }

  const subject =
    params.draft.subject || `${asText(params.context.estimate.version_name) || 'Quote'} ready`
  const bodyText = buildDefaultEmailBody({
    draft: params.draft,
    context: params.context,
    publicUrl,
    mode: params.mode,
  })

  const send = await sendGmailMessage({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    to: params.draft.to_email,
    subject,
    bodyText,
  })
  if ('error' in send) {
    return errorResult('invalid_input', send.error ?? params.copy.sendFailureMessage)
  }

  return okResult({
    mode: params.mode,
    public_url: publicUrl,
    version: publicVersion,
    document: (publicVersion.snapshot_json as Record<string, unknown> | null) ?? null,
  })
}

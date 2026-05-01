import { randomUUID } from 'node:crypto'
import { uploadDriveFile } from '@/lib/server/googleDrive'
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
  supersedeOlderPublicEstimateVersions,
  updateEstimatePublicVersionSnapshot,
  writeEstimatePublicEvent,
} from './repository'
import { buildCustomerSendPdfAttachment } from './pdf'
import type {
  CustomerSendCopy,
  CustomerSendDraft,
  CustomerSendMode,
  EstimateCustomerSendContextData,
  EstimatePublicVersionRow,
} from './types'

function readSnapshotDocument(snapshot: Record<string, unknown> | null | undefined) {
  return ((snapshot?.document as Record<string, unknown> | null | undefined) ?? snapshot ?? null)
}

function readSnapshotRecord(snapshot: unknown) {
  return snapshot && typeof snapshot === 'object' ? (snapshot as Record<string, unknown>) : {}
}

function readDriveEstimatesFolderId() {
  const folderId = process.env.GOOGLE_DRIVE_ESTIMATES_FOLDER_ID
  return typeof folderId === 'string' && folderId.trim() ? folderId.trim() : null
}

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
  let publicUrl: string | null = null
  let pendingPublicToken = asText(publicVersion.public_token)
  if (params.mode === 'send' && !pendingPublicToken) {
    pendingPublicToken = randomUUID().replace(/-/g, '')
  }
  const previewVersion =
    params.mode === 'send'
      ? ({
          ...publicVersion,
          public_token: pendingPublicToken || null,
        } as EstimatePublicVersionRow)
      : publicVersion
  publicUrl = buildCustomerSendPublicUrl({
    origin: params.origin,
    version: previewVersion,
    fallback: params.context.public_url,
  })

  const subject =
    params.draft.subject || `${asText(params.context.estimate.version_name) || 'Quote'} ready`
  const bodyText = buildDefaultEmailBody({
    draft: params.draft,
    context: params.context,
    publicUrl,
    mode: params.mode,
  })
  const document = readSnapshotDocument(
    (publicVersion.snapshot_json as Record<string, unknown> | null | undefined) ?? null
  )
  const pdfAttachment = buildCustomerSendPdfAttachment(document)
  let sentAt = ''

  if (pdfAttachment) {
    const folderId = readDriveEstimatesFolderId()
    if (folderId) {
      const upload = await uploadDriveFile({
        origin: params.origin,
        orgId: params.orgId,
        userId: params.userId,
        folderId,
        name: pdfAttachment.filename,
        mimeType: pdfAttachment.contentType,
        data: pdfAttachment.data,
      })

      if (!('error' in upload)) {
        const snapshot = readSnapshotRecord(publicVersion.snapshot_json)
        const updatedVersion = await updateEstimatePublicVersionSnapshot({
          orgId: params.orgId,
          versionId: asText(publicVersion.id),
          snapshot: {
            ...snapshot,
            pdf: {
              drive_file_id: upload.file.id,
              drive_file_name: upload.file.name,
              drive_web_view_link: upload.file.webViewLink ?? null,
              filename: pdfAttachment.filename,
              mime_type: pdfAttachment.contentType,
              saved_at: new Date().toISOString(),
            },
          },
        })
        if (updatedVersion.ok) {
          publicVersion = updatedVersion.data
        }
      }
    }
  }

  if (params.mode === 'send') {
    if (!pendingPublicToken) {
      return errorResult('server_error', params.copy.lockFailureMessage)
    }

    sentAt = new Date().toISOString()
    const sentVersion = await markEstimatePublicVersionSent({
      orgId: params.orgId,
      versionId: asText(publicVersion.id),
      publicToken: pendingPublicToken,
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
  }

  const send = await sendGmailMessage({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    to: params.draft.to_email,
    cc: params.draft.cc_email,
    bcc: params.draft.bcc_email,
    subject,
    bodyText,
    attachment: pdfAttachment,
  })
  if ('error' in send) {
    if (params.mode === 'send') {
      return okResult({
        mode: params.mode,
        public_url: publicUrl,
        version: publicVersion,
        delivery_error: send.error ?? params.copy.sendFailureMessage,
        document: readSnapshotDocument(
          (publicVersion.snapshot_json as Record<string, unknown> | null | undefined) ?? null
        ),
      })
    }
    return errorResult('invalid_input', send.error ?? params.copy.sendFailureMessage)
  }

  if (params.mode === 'send') {
    const eventResult = await writeEstimatePublicEvent({
      orgId: params.orgId,
      versionId: asText(publicVersion.id),
      eventType: 'sent',
      actorType: 'staff',
      createdBy: params.userId,
      metadata: { publicUrl },
    })
    if (!eventResult.ok) return eventResult

    const sentDocument = readSnapshotDocument(
      (publicVersion.snapshot_json as Record<string, unknown> | null | undefined) ?? null
    )
    const estimateId =
      asText((sentDocument?.meta as { estimate_id?: unknown } | undefined)?.estimate_id) ||
      asText(params.context.estimate?.id)
    if (estimateId) {
      const supersedeResult = await supersedeOlderPublicEstimateVersions({
        orgId: params.orgId,
        estimateId,
        currentVersionId: asText(publicVersion.id),
        supersededAt: sentAt,
        userId: params.userId,
      })
      if (!supersedeResult.ok) return supersedeResult
    }
  }

  return okResult({
    mode: params.mode,
    public_url: publicUrl,
    version: publicVersion,
    document: readSnapshotDocument(
      (publicVersion.snapshot_json as Record<string, unknown> | null | undefined) ?? null
    ),
  })
}

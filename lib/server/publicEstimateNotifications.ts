import { sendGmailMessage } from './googleMail.ts'
import { supabaseAdmin } from './org.ts'

type PublicEstimateNotificationDocument = {
  meta?: {
    title?: string | null
    version_name?: string | null
  } | null
  company?: {
    business_name?: string | null
    business_email?: string | null
  } | null
  customer?: {
    name?: string | null
    email?: string | null
    address?: string | null
  } | null
  total?: number | null
}

type PublicEstimateEmail = {
  to: string
  subject: string
  bodyText: string
  bodyHtml?: string
}

type PublicEstimateNotificationInput = {
  origin?: string | null
  orgId: string
  userId?: string | null
  document: PublicEstimateNotificationDocument
  publicToken?: string | null
  acceptedBy?: string | null
  acceptedAt?: string | null
  declinedAt?: string | null
  reason?: string | null
}

type PublicEstimateNotificationRuntime = {
  loadOrgInternalNotificationEmail: (orgId: string) => Promise<string | null>
  sendGmailMessage: (input: {
    origin: string
    orgId: string
    userId: string
    to: string
    subject: string
    bodyText: string
    bodyHtml?: string
  }) => Promise<
    | { messageId: string }
    | {
        error: string | undefined
      }
  >
}

const defaultNotificationRuntime: PublicEstimateNotificationRuntime = {
  loadOrgInternalNotificationEmail,
  sendGmailMessage,
}

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function quoteTitle(document: PublicEstimateNotificationDocument) {
  return asText(document.meta?.title) || 'Quote'
}

function pickText(row: Record<string, unknown> | null | undefined, candidates: string[]) {
  for (const key of candidates) {
    const value = asText(row?.[key])
    if (value) return value
  }
  return null
}

async function loadOrgInternalNotificationEmail(orgId: string) {
  const { data, error } = await supabaseAdmin
    .from('orgs')
    .select('*')
    .eq('id', orgId)
    .maybeSingle()
  if (error) return null

  return pickText(data as Record<string, unknown> | null, [
    'business_email',
    'email',
    'company_email',
    'from_email',
  ])
}

function withInternalNotificationEmail(
  document: PublicEstimateNotificationDocument,
  internalEmail: string | null
) {
  const email = asText(internalEmail)
  if (!email) return document

  return {
    ...document,
    company: {
      ...(document.company ?? {}),
      business_email: email,
    },
  }
}

function publicQuoteUrl(input: Pick<PublicEstimateNotificationInput, 'origin' | 'publicToken'>) {
  const origin = asText(input.origin).replace(/\/+$/, '')
  const token = asText(input.publicToken)
  return origin && token ? `${origin}/quote/${encodeURIComponent(token)}` : ''
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildAcceptedCustomerHtml(params: {
  businessName: string
  customerName: string
  acceptedAt: string
  publicUrl: string
  quoteTitle: string
}) {
  const quoteLine = `Thanks for accepting ${params.quoteTitle}.`
  const acceptedAt = params.acceptedAt || '-'
  const button = params.publicUrl
    ? `
      <p style="margin:24px 0 0;">
        <a href="${escapeHtml(params.publicUrl)}" style="display:inline-block;background:#0b6b3a;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;padding:12px 18px;">View accepted quote</a>
      </p>`
    : ''

  return `
    <div style="margin:0;padding:0;background:#f6f7f4;font-family:Arial,sans-serif;color:#172018;">
      <div style="max-width:560px;margin:0 auto;padding:28px 20px;">
        <div style="background:#ffffff;border:1px solid #dfe6dc;border-radius:12px;padding:28px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">Hi ${escapeHtml(params.customerName)},</p>
          <h1 style="margin:0 0 14px;font-size:24px;line-height:1.2;color:#075f36;">Quote accepted</h1>
          <p style="margin:0 0 18px;font-size:16px;line-height:1.5;">${escapeHtml(quoteLine)}</p>
          <p style="margin:0 0 22px;font-size:16px;line-height:1.5;">We'll contact you to schedule the work.</p>
          <div style="border-top:1px solid #e5e9e3;border-bottom:1px solid #e5e9e3;padding:14px 0;margin:0 0 4px;">
            <p style="margin:0;color:#526054;font-size:13px;text-transform:uppercase;letter-spacing:.04em;">Accepted at</p>
            <p style="margin:4px 0 0;font-size:15px;line-height:1.4;">${escapeHtml(acceptedAt)}</p>
          </div>
          ${button}
          <p style="margin:26px 0 0;font-size:15px;line-height:1.5;color:#526054;">${escapeHtml(params.businessName)}</p>
        </div>
      </div>
    </div>
  `.trim()
}

function buildDetailRow(label: string, value: string) {
  return `
    <tr>
      <td style="padding:9px 0;color:#526054;font-size:13px;width:145px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:9px 0;color:#172018;font-size:14px;line-height:1.4;vertical-align:top;">${escapeHtml(value || '-')}</td>
    </tr>
  `
}

function buildInternalActionButton(publicUrl: string) {
  if (!publicUrl) return ''
  return `
    <p style="margin:24px 0 0;">
      <a href="${escapeHtml(publicUrl)}" style="display:inline-block;background:#0b6b3a;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;padding:12px 18px;">View accepted quote</a>
    </p>
  `
}

function buildAcceptedInternalHtml(params: {
  acceptedAt: string
  acceptedBy: string
  customerAddress: string
  customerEmail: string
  customerName: string
  publicUrl: string
  quoteTitle: string
  total: string
  versionName: string
}) {
  return `
    <div style="margin:0;padding:0;background:#f6f7f4;font-family:Arial,sans-serif;color:#172018;">
      <div style="max-width:640px;margin:0 auto;padding:28px 20px;">
        <div style="background:#ffffff;border:1px solid #dfe6dc;border-radius:12px;padding:28px;">
          <p style="margin:0 0 10px;color:#0b6b3a;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">Quote accepted</p>
          <h1 style="margin:0 0 18px;font-size:24px;line-height:1.2;color:#172018;">${escapeHtml(params.quoteTitle)}</h1>
          <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;border-top:1px solid #e5e9e3;border-bottom:1px solid #e5e9e3;">
            ${buildDetailRow('Accepted by', params.acceptedBy)}
            ${buildDetailRow('Accepted at', params.acceptedAt)}
            ${buildDetailRow('Customer', params.customerName)}
            ${buildDetailRow('Customer email', params.customerEmail)}
            ${buildDetailRow('Customer address', params.customerAddress)}
            ${buildDetailRow('Version', params.versionName)}
            ${params.total ? buildDetailRow('Total', params.total) : ''}
          </table>
          ${buildInternalActionButton(params.publicUrl)}
        </div>
      </div>
    </div>
  `.trim()
}

function buildDeclinedInternalHtml(params: {
  customerAddress: string
  customerEmail: string
  customerName: string
  declinedAt: string
  publicUrl: string
  quoteTitle: string
  reason: string
  total: string
  versionName: string
}) {
  return `
    <div style="margin:0;padding:0;background:#f6f7f4;font-family:Arial,sans-serif;color:#172018;">
      <div style="max-width:640px;margin:0 auto;padding:28px 20px;">
        <div style="background:#ffffff;border:1px solid #dfe6dc;border-radius:12px;padding:28px;">
          <p style="margin:0 0 10px;color:#9a5b00;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">Quote declined</p>
          <h1 style="margin:0 0 18px;font-size:24px;line-height:1.2;color:#172018;">${escapeHtml(params.quoteTitle)}</h1>
          <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;border-top:1px solid #e5e9e3;border-bottom:1px solid #e5e9e3;">
            ${buildDetailRow('Declined at', params.declinedAt)}
            ${buildDetailRow('Reason', params.reason)}
            ${buildDetailRow('Customer', params.customerName)}
            ${buildDetailRow('Customer email', params.customerEmail)}
            ${buildDetailRow('Customer address', params.customerAddress)}
            ${buildDetailRow('Version', params.versionName)}
            ${params.total ? buildDetailRow('Total', params.total) : ''}
          </table>
          ${buildInternalActionButton(params.publicUrl)}
        </div>
      </div>
    </div>
  `.trim()
}

function baseInternalLines(params: {
  document: PublicEstimateNotificationDocument
  publicUrl: string
}) {
  const total = formatMoney(params.document.total)
  return [
    `Customer: ${asText(params.document.customer?.name) || '-'}`,
    `Customer email: ${asText(params.document.customer?.email) || '-'}`,
    `Customer address: ${asText(params.document.customer?.address) || '-'}`,
    `Quote: ${quoteTitle(params.document)}`,
    `Version: ${asText(params.document.meta?.version_name) || '-'}`,
    total ? `Total: ${total}` : '',
    params.publicUrl ? `Accepted quote link: ${params.publicUrl}` : '',
  ].filter(Boolean)
}

export function buildPublicEstimateAcceptedInternalEmail(params: {
  document: PublicEstimateNotificationDocument
  acceptedBy?: string | null
  acceptedAt?: string | null
  publicUrl?: string | null
}): PublicEstimateEmail | null {
  const to = asText(params.document.company?.business_email)
  if (!to) return null

  const lines = [
    'A customer accepted a quote.',
    '',
    `Accepted by: ${asText(params.acceptedBy) || '-'}`,
    `Accepted at: ${asText(params.acceptedAt) || '-'}`,
    ...baseInternalLines({
      document: params.document,
      publicUrl: asText(params.publicUrl),
    }),
  ]

  return {
    to,
    subject: `Quote accepted: ${quoteTitle(params.document)}`,
    bodyText: lines.join('\n'),
    bodyHtml: buildAcceptedInternalHtml({
      acceptedAt: asText(params.acceptedAt) || '-',
      acceptedBy: asText(params.acceptedBy) || '-',
      customerAddress: asText(params.document.customer?.address) || '-',
      customerEmail: asText(params.document.customer?.email) || '-',
      customerName: asText(params.document.customer?.name) || '-',
      publicUrl: asText(params.publicUrl),
      quoteTitle: quoteTitle(params.document),
      total: formatMoney(params.document.total),
      versionName: asText(params.document.meta?.version_name) || '-',
    }),
  }
}

export function buildPublicEstimateDeclinedInternalEmail(params: {
  document: PublicEstimateNotificationDocument
  declinedAt?: string | null
  publicUrl?: string | null
  reason?: string | null
}): PublicEstimateEmail | null {
  const to = asText(params.document.company?.business_email)
  if (!to) return null

  const lines = [
    'A customer declined a quote.',
    '',
    `Declined at: ${asText(params.declinedAt) || '-'}`,
    `Reason: ${asText(params.reason) || '-'}`,
    ...baseInternalLines({
      document: params.document,
      publicUrl: asText(params.publicUrl),
    }),
  ]

  return {
    to,
    subject: `Quote declined: ${quoteTitle(params.document)}`,
    bodyText: lines.join('\n'),
    bodyHtml: buildDeclinedInternalHtml({
      customerAddress: asText(params.document.customer?.address) || '-',
      customerEmail: asText(params.document.customer?.email) || '-',
      customerName: asText(params.document.customer?.name) || '-',
      declinedAt: asText(params.declinedAt) || '-',
      publicUrl: asText(params.publicUrl),
      quoteTitle: quoteTitle(params.document),
      reason: asText(params.reason) || '-',
      total: formatMoney(params.document.total),
      versionName: asText(params.document.meta?.version_name) || '-',
    }),
  }
}

export function buildPublicEstimateAcceptedCustomerEmail(params: {
  document: PublicEstimateNotificationDocument
  acceptedAt?: string | null
  publicUrl?: string | null
}): PublicEstimateEmail | null {
  const to = asText(params.document.customer?.email)
  if (!to) return null

  const businessName = asText(params.document.company?.business_name) || 'ACE Painting'
  const customerName = asText(params.document.customer?.name) || 'there'
  const publicUrl = asText(params.publicUrl)
  const title = quoteTitle(params.document)
  const lines = [
    `Hi ${customerName},`,
    '',
    `Thanks for accepting ${title}.`,
    "We'll contact you to schedule.",
    '',
    `Accepted at: ${asText(params.acceptedAt) || '-'}`,
    publicUrl ? `Accepted quote link: ${publicUrl}` : '',
    '',
    businessName,
  ].filter(Boolean)

  return {
    to,
    subject: `Quote accepted: ${title}`,
    bodyText: lines.join('\n'),
    bodyHtml: buildAcceptedCustomerHtml({
      businessName,
      customerName,
      acceptedAt: asText(params.acceptedAt),
      publicUrl,
      quoteTitle: title,
    }),
  }
}

async function sendNotificationEmail(
  input: PublicEstimateNotificationInput,
  email: PublicEstimateEmail | null,
  runtime: PublicEstimateNotificationRuntime
) {
  const userId = asText(input.userId)
  const origin = asText(input.origin)
  if (!email) return { skipped: true as const, reason: 'missing_recipient_email' as const }
  if (!userId) return { skipped: true as const, reason: 'missing_sender_user' as const }
  if (!origin) return { skipped: true as const, reason: 'missing_origin' as const }

  return runtime.sendGmailMessage({
    origin,
    orgId: input.orgId,
    userId,
    to: email.to,
    subject: email.subject,
    bodyText: email.bodyText,
    bodyHtml: email.bodyHtml,
  }).catch((error: unknown) => ({
    error: error instanceof Error ? error.message : 'Unable to send notification email',
  }))
}

export async function sendPublicEstimateAcceptanceNotifications(
  input: PublicEstimateNotificationInput,
  runtime: Partial<PublicEstimateNotificationRuntime> = {}
) {
  const normalizedRuntime: PublicEstimateNotificationRuntime = {
    ...defaultNotificationRuntime,
    ...runtime,
  }
  const publicUrl = publicQuoteUrl(input)
  const internalDocument = withInternalNotificationEmail(
    input.document,
    await normalizedRuntime.loadOrgInternalNotificationEmail(input.orgId)
  )
  const internal = buildPublicEstimateAcceptedInternalEmail({
    document: internalDocument,
    acceptedBy: input.acceptedBy,
    acceptedAt: input.acceptedAt,
    publicUrl,
  })
  const customer = buildPublicEstimateAcceptedCustomerEmail({
    document: input.document,
    acceptedAt: input.acceptedAt,
    publicUrl,
  })

  const [internalResult, customerResult] = await Promise.all([
    sendNotificationEmail(input, internal, normalizedRuntime),
    sendNotificationEmail(input, customer, normalizedRuntime),
  ])

  return {
    internal: internalResult,
    customer: customerResult,
  }
}

export async function sendPublicEstimateDeclineNotification(
  input: PublicEstimateNotificationInput,
  runtime: Partial<PublicEstimateNotificationRuntime> = {}
) {
  const normalizedRuntime: PublicEstimateNotificationRuntime = {
    ...defaultNotificationRuntime,
    ...runtime,
  }
  const internalDocument = withInternalNotificationEmail(
    input.document,
    await normalizedRuntime.loadOrgInternalNotificationEmail(input.orgId)
  )
  const internal = buildPublicEstimateDeclinedInternalEmail({
    document: internalDocument,
    declinedAt: input.declinedAt,
    publicUrl: publicQuoteUrl(input),
    reason: input.reason,
  })

  return {
    internal: await sendNotificationEmail(input, internal, normalizedRuntime),
  }
}

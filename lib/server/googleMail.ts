import { getValidAccessToken } from '@/lib/server/googleCalendar'
import { supabaseAdmin } from '@/lib/server/org'

function base64UrlEncode(value: Buffer | string) {
  const buf = typeof value === 'string' ? Buffer.from(value) : value
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function pickOrgText(row: Record<string, unknown>, candidates: string[]) {
  for (const key of candidates) {
    const raw = row[key]
    if (typeof raw === 'string' && raw.trim()) return raw.trim()
  }
  return null
}

function sanitizeHeaderValue(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

const EMAIL_PATTERN = /^[^\s@<>,;:"]+@[^\s@<>,;:"]+\.[^\s@<>,;:"]+$/

function normalizeRecipientList(value: string) {
  const cleaned = sanitizeHeaderValue(value)
  if (!cleaned) return [] as string[]
  return cleaned
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function parseRecipientList(value: string) {
  const recipients = normalizeRecipientList(value)
  if (recipients.length === 0) return { ok: true as const, recipients }
  const invalid = recipients.some((recipient) => !EMAIL_PATTERN.test(recipient))
  if (invalid) return { ok: false as const, recipients: [] as string[] }
  return { ok: true as const, recipients }
}

function formatMailboxHeader(name: string | null, email: string | null) {
  if (!email) return null
  const safeEmail = sanitizeHeaderValue(email)
  if (!safeEmail) return null

  const safeName = name ? sanitizeHeaderValue(name).replace(/"/g, '\\"') : ''
  return safeName ? `"${safeName}" <${safeEmail}>` : safeEmail
}

async function getOrgSenderProfile(orgId: string) {
  const { data, error } = await supabaseAdmin
    .from('orgs')
    .select('*')
    .eq('id', orgId)
    .maybeSingle()
  if (error) throw error

  const row = (data ?? {}) as Record<string, unknown>
  return {
    fromName: pickOrgText(row, ['name', 'business_name', 'company_name']) ?? 'ACE Painting',
    fromEmail: pickOrgText(row, ['business_email', 'email', 'company_email', 'from_email']),
  }
}

export async function sendGmailMessage(params: {
  origin: string
  orgId: string
  userId: string
  to: string
  cc?: string | null
  bcc?: string | null
  subject: string
  bodyText: string
  attachment?: { filename: string; contentType: string; data: Buffer } | null
  attachments?: Array<{ filename: string; contentType: string; data: Buffer }> | null
}) {
  const access = await getValidAccessToken({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
  })
  if ('error' in access) return { error: access.error } as const

  const sender = await getOrgSenderProfile(params.orgId)
  const fromHeader = formatMailboxHeader(sender.fromName, sender.fromEmail)
  const toRecipients = parseRecipientList(params.to)
  const ccRecipients = parseRecipientList(params.cc ?? '')
  const bccRecipients = parseRecipientList(params.bcc ?? '')
  if (!toRecipients.ok) return { error: 'Invalid To recipient list' } as const
  if (!ccRecipients.ok) return { error: 'Invalid Cc recipient list' } as const
  if (!bccRecipients.ok) return { error: 'Invalid Bcc recipient list' } as const

  const toHeader = toRecipients.recipients.join(', ')
  const ccHeader = ccRecipients.recipients.join(', ')
  const bccHeader = bccRecipients.recipients.join(', ')
  const subjectHeader = sanitizeHeaderValue(params.subject)
  if (!toHeader) return { error: 'Recipient email is required' } as const
  if (!subjectHeader) return { error: 'Subject is required' } as const
  const boundary = `acecrm_${Date.now()}`
  const normalizedAttachments = (
    Array.isArray(params.attachments) ? params.attachments : params.attachment ? [params.attachment] : []
  ).filter(Boolean)

  let raw = ''
  if (fromHeader) raw += `From: ${fromHeader}\r\n`
  raw += `To: ${toHeader}\r\n`
  if (ccHeader) raw += `Cc: ${ccHeader}\r\n`
  if (bccHeader) raw += `Bcc: ${bccHeader}\r\n`
  raw += `Subject: ${subjectHeader}\r\n`
  raw += 'MIME-Version: 1.0\r\n'

  if (normalizedAttachments.length > 0) {
    raw += `Content-Type: multipart/mixed; boundary=\"${boundary}\"\r\n\r\n`
    raw += `--${boundary}\r\n`
    raw += 'Content-Type: text/plain; charset="UTF-8"\r\n\r\n'
    raw += `${params.bodyText}\r\n\r\n`
    for (const attachment of normalizedAttachments) {
      const safeFileName = sanitizeHeaderValue(attachment.filename).replace(/"/g, '')
      raw += `--${boundary}\r\n`
      raw += `Content-Type: ${attachment.contentType}; name="${safeFileName}"\r\n`
      raw += 'Content-Transfer-Encoding: base64\r\n'
      raw += `Content-Disposition: attachment; filename="${safeFileName}"\r\n\r\n`
      raw += `${attachment.data.toString('base64')}\r\n`
    }
    raw += `--${boundary}--`
  } else {
    raw += 'Content-Type: text/plain; charset="UTF-8"\r\n\r\n'
    raw += params.bodyText
  }

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: base64UrlEncode(raw) }),
  })

  const json: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const obj = asRecord(json)
    const err = asRecord(obj?.error)
    const msg = (typeof err?.message === 'string' ? err.message : null) ?? 'Failed to send email'
    return { error: msg } as const
  }

  const obj = asRecord(json)
  return { messageId: typeof obj?.id === 'string' ? obj.id : '' } as const
}

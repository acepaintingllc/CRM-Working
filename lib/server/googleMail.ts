import { getValidAccessToken } from './googleCalendar.ts'
import { supabaseAdmin } from './org.ts'
import { loadCompanyProfileSettings } from './settings/companyProfileStore.ts'

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

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
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
const GOOGLE_MAIL_TIMEOUT_MS = 20_000

function timeoutSignal(timeoutMs: number) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }
  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

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
    .select('name, business_email')
    .eq('id', orgId)
    .maybeSingle()
  if (error) throw error

  const row = (data ?? {}) as Record<string, unknown>
  const companyProfile = await loadCompanyProfileSettings(orgId).catch(() => null)
  return {
    fromName: asText(companyProfile?.business_name) || pickOrgText(row, ['name']) || 'ACE Painting',
    fromEmail: asText(companyProfile?.business_email) || pickOrgText(row, ['business_email']),
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
  bodyHtml?: string | null
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
  const alternativeBoundary = `${boundary}_alt`
  const normalizedAttachments = (
    Array.isArray(params.attachments) ? params.attachments : params.attachment ? [params.attachment] : []
  ).filter(Boolean)
  const bodyHtml = typeof params.bodyHtml === 'string' && params.bodyHtml.trim() ? params.bodyHtml : ''

  function appendPlainTextBody() {
    raw += 'Content-Type: text/plain; charset="UTF-8"\r\n\r\n'
    raw += params.bodyText
  }

  function appendAlternativeBody() {
    raw += `Content-Type: multipart/alternative; boundary=\"${alternativeBoundary}\"\r\n\r\n`
    raw += `--${alternativeBoundary}\r\n`
    raw += 'Content-Type: text/plain; charset="UTF-8"\r\n\r\n'
    raw += `${params.bodyText}\r\n\r\n`
    raw += `--${alternativeBoundary}\r\n`
    raw += 'Content-Type: text/html; charset="UTF-8"\r\n\r\n'
    raw += `${bodyHtml}\r\n\r\n`
    raw += `--${alternativeBoundary}--`
  }

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
    if (bodyHtml) {
      appendAlternativeBody()
    } else {
      appendPlainTextBody()
    }
    raw += '\r\n\r\n'
    for (const attachment of normalizedAttachments) {
      const safeFileName = sanitizeHeaderValue(attachment.filename).replace(/"/g, '')
      raw += `--${boundary}\r\n`
      raw += `Content-Type: ${attachment.contentType}; name="${safeFileName}"\r\n`
      raw += 'Content-Transfer-Encoding: base64\r\n'
      raw += `Content-Disposition: attachment; filename="${safeFileName}"\r\n\r\n`
      raw += `${attachment.data.toString('base64')}\r\n`
    }
    raw += `--${boundary}--`
  } else if (bodyHtml) {
    appendAlternativeBody()
  } else {
    appendPlainTextBody()
  }

  let res: Response
  try {
    res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: base64UrlEncode(raw) }),
      signal: timeoutSignal(GOOGLE_MAIL_TIMEOUT_MS),
    })
  } catch (error) {
    return {
      error: isAbortError(error)
        ? 'Timed out sending email through Gmail. The customer link is ready; copy the link or try sending again.'
        : 'Failed to send email',
    } as const
  }

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

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
  subject: string
  bodyText: string
  attachment?: { filename: string; contentType: string; data: Buffer } | null
}) {
  const access = await getValidAccessToken({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
  })
  if ('error' in access) return { error: access.error } as const

  const sender = await getOrgSenderProfile(params.orgId)
  const fromHeader = formatMailboxHeader(sender.fromName, sender.fromEmail)
  const boundary = `acecrm_${Date.now()}`

  let raw = ''
  if (fromHeader) raw += `From: ${fromHeader}\r\n`
  raw += `To: ${params.to}\r\n`
  raw += `Subject: ${params.subject}\r\n`
  raw += 'MIME-Version: 1.0\r\n'

  if (params.attachment) {
    raw += `Content-Type: multipart/mixed; boundary=\"${boundary}\"\r\n\r\n`
    raw += `--${boundary}\r\n`
    raw += 'Content-Type: text/plain; charset="UTF-8"\r\n\r\n'
    raw += `${params.bodyText}\r\n\r\n`
    raw += `--${boundary}\r\n`
    raw += `Content-Type: ${params.attachment.contentType}; name="${params.attachment.filename}"\r\n`
    raw += 'Content-Transfer-Encoding: base64\r\n'
    raw += `Content-Disposition: attachment; filename="${params.attachment.filename}"\r\n\r\n`
    raw += `${params.attachment.data.toString('base64')}\r\n`
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

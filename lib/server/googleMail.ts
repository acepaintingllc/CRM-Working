import { getValidAccessToken } from '@/lib/server/googleCalendar'

function base64UrlEncode(value: Buffer | string) {
  const buf = typeof value === 'string' ? Buffer.from(value) : value
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
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

  const boundary = `acecrm_${Date.now()}`

  let raw = ''
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

  const json: any = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = json?.error?.message ?? 'Failed to send email'
    return { error: msg } as const
  }

  return { messageId: json?.id as string } as const
}

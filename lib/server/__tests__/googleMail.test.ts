import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getValidAccessToken: vi.fn(),
  maybeSingle: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/server/googleCalendar', () => ({
  getValidAccessToken: mocks.getValidAccessToken,
}))

vi.mock('@/lib/server/org', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { sendGmailMessage } from '../googleMail'

function decodeRawMessage(raw: string) {
  const normalized = raw.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(normalized, 'base64').toString('utf8')
}

describe('sendGmailMessage', () => {
  beforeEach(() => {
    mocks.getValidAccessToken.mockReset()
    mocks.maybeSingle.mockReset()
    mocks.eq.mockReset()
    mocks.select.mockReset()
    mocks.from.mockReset()

    mocks.getValidAccessToken.mockResolvedValue({ accessToken: 'token-1' })
    mocks.maybeSingle.mockResolvedValue({
      data: {
        business_name: 'ACE Painting',
        business_email: 'sales@example.com',
      },
      error: null,
    })
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle })
    mocks.select.mockReturnValue({ eq: mocks.eq })
    mocks.from.mockReturnValue({ select: mocks.select })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'gmail-message-1' }),
      })
    )
  })

  it('rejects empty recipients and empty subjects after sanitization', async () => {
    const noRecipient = await sendGmailMessage({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      to: '\n',
      subject: 'Quote ready',
      bodyText: 'Body',
    })
    expect(noRecipient).toEqual({ error: 'Recipient email is required' })

    const noSubject = await sendGmailMessage({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      to: 'customer@example.com',
      subject: '\r\n',
      bodyText: 'Body',
    })
    expect(noSubject).toEqual({ error: 'Subject is required' })
  })

  it('sanitizes to/cc/bcc/subject headers before composing MIME message', async () => {
    const result = await sendGmailMessage({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      to: 'customer@example.com\r\nBCC:bad@example.com',
      cc: 'team@example.com\r\nInjected: nope',
      bcc: 'owner@example.com\r\nOops: nope',
      subject: 'Quote ready\r\nExtra',
      bodyText: 'Body copy',
    })

    expect(result).toEqual({ messageId: 'gmail-message-1' })
    const fetchMock = vi.mocked(fetch)
    const [, init] = fetchMock.mock.calls[0]
    const payload = JSON.parse(String(init?.body)) as { raw: string }
    const rawMessage = decodeRawMessage(payload.raw)

    expect(rawMessage).toContain('To: customer@example.com BCC:bad@example.com')
    expect(rawMessage).toContain('Cc: team@example.com Injected: nope')
    expect(rawMessage).toContain('Bcc: owner@example.com Oops: nope')
    expect(rawMessage).toContain('Subject: Quote ready Extra')
  })
})

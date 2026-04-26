import { beforeEach, describe, expect, it, vi } from 'vitest'
import { submitCustomerSendMessage } from '../delivery'

const {
  mockSendGmailMessage,
  mockMarkEstimatePublicVersionSent,
  mockWriteEstimatePublicEvent,
} = vi.hoisted(() => ({
  mockSendGmailMessage: vi.fn(),
  mockMarkEstimatePublicVersionSent: vi.fn(),
  mockWriteEstimatePublicEvent: vi.fn(),
}))

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>()
  return {
    ...actual,
    randomUUID: () => 'test-token-1234',
  }
})

vi.mock('@/lib/server/googleMail', () => ({
  sendGmailMessage: mockSendGmailMessage,
}))

vi.mock('../repository', () => ({
  markEstimatePublicVersionSent: mockMarkEstimatePublicVersionSent,
  writeEstimatePublicEvent: mockWriteEstimatePublicEvent,
}))

const baseParams = {
  origin: 'https://example.test',
  orgId: 'org-1',
  userId: 'user-1',
  draft: {
    to_email: 'customer@example.com',
    cc_email: '',
    bcc_email: '',
    subject: '',
    body: '',
    template_key: 'default',
    title: 'Kitchen Quote',
    intro_paragraph: '',
    closing_paragraph: '',
    terms_text: '',
    scope_text_edits: {
      walls: '',
      ceilings: '',
      trim: '',
      doors: '',
      cabinets: '',
      other: '',
    },
    quote_validity_days: 30,
    deposit_language: '',
    card_fee_note: '',
  },
  context: {
    estimate: {
      version_name: 'Kitchen Quote',
    },
    job: {
      customer_name: 'Taylor',
    },
    company: {
      business_name: 'ACE Painting',
      sender_signature: 'Thanks,\nACE Painting',
    },
    public_url: null,
  },
  copy: {
    sendNotice: 'Quote sent.',
    sendFailureMessage: 'Unable to send quote',
    lockFailureMessage: 'Unable to lock quote',
  },
}

describe('customer send delivery', () => {
  beforeEach(() => {
    mockSendGmailMessage.mockReset()
    mockMarkEstimatePublicVersionSent.mockReset()
    mockWriteEstimatePublicEvent.mockReset()
    mockSendGmailMessage.mockResolvedValue({ id: 'gmail-1' })
    mockWriteEstimatePublicEvent.mockResolvedValue({ ok: true, data: null })
  })

  it('sends a test email without locking the public version', async () => {
    const result = await submitCustomerSendMessage({
      ...baseParams,
      mode: 'test',
      version: {
        id: 'draft-1',
        snapshot_json: { document: true },
      },
    } as never)

    expect(mockMarkEstimatePublicVersionSent).not.toHaveBeenCalled()
    expect(mockSendGmailMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'customer@example.com',
        cc: '',
        bcc: '',
      })
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.mode).toBe('test')
  })

  it('locks, tokenizes, logs, and sends for a live send', async () => {
    mockMarkEstimatePublicVersionSent.mockResolvedValue({
      ok: true,
      data: {
        id: 'draft-1',
        public_token: 'testtoken1234',
        snapshot_json: { document: true },
      },
    })

    const result = await submitCustomerSendMessage({
      ...baseParams,
      mode: 'send',
      version: {
        id: 'draft-1',
        public_token: null,
        snapshot_json: { document: true },
      },
    } as never)

    expect(mockMarkEstimatePublicVersionSent).toHaveBeenCalledWith(
      expect.objectContaining({
        versionId: 'draft-1',
        publicToken: expect.stringMatching(/^[a-z0-9]+$/i),
      })
    )
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'sent',
        metadata: {
          publicUrl: 'https://example.test/quote/testtoken1234',
        },
      })
    )
    expect(mockSendGmailMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyText: expect.stringContaining('https://example.test/quote/testtoken1234'),
      })
    )
    expect(result.ok).toBe(true)
  })

  it('maps Gmail failures to invalid input errors', async () => {
    mockSendGmailMessage.mockResolvedValue({
      error: 'Gmail not configured',
    })

    const result = await submitCustomerSendMessage({
      ...baseParams,
      mode: 'test',
      version: {
        id: 'draft-1',
        snapshot_json: { document: true },
      },
    } as never)

    expect(result).toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Gmail not configured',
    })
  })

  it('passes cc and bcc recipients through to Gmail send', async () => {
    await submitCustomerSendMessage({
      ...baseParams,
      mode: 'test',
      draft: {
        ...baseParams.draft,
        cc_email: 'team@example.com',
        bcc_email: 'owner@example.com',
      },
      version: {
        id: 'draft-1',
        snapshot_json: { document: true },
      },
    } as never)

    expect(mockSendGmailMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'customer@example.com',
        cc: 'team@example.com',
        bcc: 'owner@example.com',
      })
    )
  })
})

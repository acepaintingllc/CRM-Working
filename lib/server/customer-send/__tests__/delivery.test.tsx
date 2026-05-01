import { beforeEach, describe, expect, it, vi } from 'vitest'
import { submitCustomerSendMessage } from '../delivery'

const {
  mockSendGmailMessage,
  mockUploadDriveFile,
  mockMarkEstimatePublicVersionSent,
  mockSupersedeOlderPublicEstimateVersions,
  mockUpdateEstimatePublicVersionSnapshot,
  mockWriteEstimatePublicEvent,
} = vi.hoisted(() => ({
  mockSendGmailMessage: vi.fn(),
  mockUploadDriveFile: vi.fn(),
  mockMarkEstimatePublicVersionSent: vi.fn(),
  mockSupersedeOlderPublicEstimateVersions: vi.fn(),
  mockUpdateEstimatePublicVersionSnapshot: vi.fn(),
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

vi.mock('@/lib/server/googleDrive', () => ({
  uploadDriveFile: mockUploadDriveFile,
}))

vi.mock('../repository', () => ({
  markEstimatePublicVersionSent: mockMarkEstimatePublicVersionSent,
  supersedeOlderPublicEstimateVersions: mockSupersedeOlderPublicEstimateVersions,
  updateEstimatePublicVersionSnapshot: mockUpdateEstimatePublicVersionSnapshot,
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
      id: 'estimate-1',
      version_name: 'Kitchen Quote',
    },
    job: {
      customer_name: 'Taylor',
    },
    company: {
      business_name: 'ACE Painting',
      business_email: 'owner@example.com',
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

const assembledDocument = {
  meta: {
    estimate_id: 'estimate-1',
    version_name: 'Estimate Version 1',
    version_state: 'draft',
    flow_version: 'v2',
    title: 'Living Room Quote',
    quote_date: '2026-04-28',
    sent_at: null,
    viewed_at: null,
    accepted_at: null,
    declined_at: null,
    status: 'draft',
    public_token: null,
  },
  company: {
    business_name: 'ACE Painting',
    timezone: 'America/Chicago',
    main_phone: '',
    business_email: '',
    address: '',
    website: '',
    sender_signature: '',
    logo_url: '',
  },
  customer: {
    name: 'Taylor',
    email: 'customer@example.com',
    phone: '',
    address: '123 Main St',
    street: '123 Main St',
    city: '',
    state: '',
    zip: '',
  },
  header: {
    company_name: 'ACE Painting',
    contact_lines: ['Austin, TX'],
    logo_url: '',
    document_label: 'QUOTE',
    quote_date_label: '4/28/26',
  },
  customer_block: {
    lines: ['Taylor', '123 Main St'],
  },
  pricing_block: {
    rows: [
      {
        key: 'walls',
        label: 'Walls',
        description: 'Paint walls in the listed rooms.',
        price: 1200,
      },
    ],
    total: 1200,
    footer_note: 'Thank you for the opportunity.',
  },
  terms_page: {
    title: 'Terms',
    sections: [
      {
        key: 'pricing',
        title: 'Pricing & Payment Terms',
        paragraphs: ['Pricing is valid for 30 days.'],
      },
    ],
  },
}

describe('customer send delivery', () => {
  beforeEach(() => {
    mockSendGmailMessage.mockReset()
    mockUploadDriveFile.mockReset()
    mockMarkEstimatePublicVersionSent.mockReset()
    mockSupersedeOlderPublicEstimateVersions.mockReset()
    mockUpdateEstimatePublicVersionSnapshot.mockReset()
    mockWriteEstimatePublicEvent.mockReset()
    delete process.env.GOOGLE_DRIVE_ESTIMATES_FOLDER_ID
    mockSendGmailMessage.mockResolvedValue({ id: 'gmail-1' })
    mockUploadDriveFile.mockResolvedValue({
      file: {
        id: 'drive-1',
        name: 'ACE-Painting_123-Main-St_2026-04-28_Living-Room-Quote.pdf',
        webViewLink: 'https://drive.test/file/drive-1',
      },
    })
    mockUpdateEstimatePublicVersionSnapshot.mockImplementation(async (params: { snapshot: Record<string, unknown> }) => ({
      ok: true,
      data: {
        id: 'draft-1',
        snapshot_json: params.snapshot,
      },
    }))
    mockWriteEstimatePublicEvent.mockResolvedValue({ ok: true, data: null })
    mockSupersedeOlderPublicEstimateVersions.mockResolvedValue({
      ok: true,
      data: { supersededIds: [] },
    })
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
    mockMarkEstimatePublicVersionSent.mockImplementation(async (params: { publicToken: string }) => ({
      ok: true,
      data: {
        id: 'draft-1',
        public_token: params.publicToken,
        snapshot_json: { document: true },
      },
    }))

    const result = await submitCustomerSendMessage({
      ...baseParams,
      mode: 'send',
      version: {
        id: 'draft-1',
        public_token: null,
        snapshot_json: { document: true },
      },
    } as never)

    const markOrder = mockMarkEstimatePublicVersionSent.mock.invocationCallOrder[0]
    const sendOrder = mockSendGmailMessage.mock.invocationCallOrder[0]
    expect(markOrder).toBeLessThan(sendOrder)
    expect(mockMarkEstimatePublicVersionSent).toHaveBeenCalledWith(
      expect.objectContaining({
        versionId: 'draft-1',
        publicToken: expect.stringMatching(/^[a-z0-9]+$/i),
      })
    )
    const [[markParams]] = mockMarkEstimatePublicVersionSent.mock.calls as Array<[
      { publicToken: string },
    ]>
    const publicUrl = `https://example.test/quote/${markParams.publicToken}`
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'sent',
        metadata: {
          publicUrl,
        },
      })
    )
    expect(mockSupersedeOlderPublicEstimateVersions).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        estimateId: 'estimate-1',
        currentVersionId: 'draft-1',
        userId: 'user-1',
      })
    )
    expect(mockSendGmailMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyText: expect.stringContaining(publicUrl),
      })
    )
    expect(result.ok).toBe(true)
  })

  it('locks the public link before live send and skips sent events when Gmail fails', async () => {
    mockSendGmailMessage.mockResolvedValue({
      error: 'Gmail not configured',
    })
    mockMarkEstimatePublicVersionSent.mockImplementation(async (params: { publicToken: string }) => ({
      ok: true,
      data: {
        id: 'draft-1',
        public_token: params.publicToken,
        snapshot_json: { document: true },
      },
    }))

    const result = await submitCustomerSendMessage({
      ...baseParams,
      mode: 'send',
      version: {
        id: 'draft-1',
        public_token: null,
        snapshot_json: { document: true },
      },
    } as never)

    expect(mockMarkEstimatePublicVersionSent).toHaveBeenCalled()
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        mode: 'send',
        public_url: expect.stringMatching(/^https:\/\/example\.test\/quote\/[a-z0-9]+$/i),
        version: expect.objectContaining({
          id: 'draft-1',
          public_token: expect.any(String),
          snapshot_json: { document: true },
        }),
        delivery_error: 'Gmail not configured',
        document: true,
      }),
    })
    if (!result.ok) return
    expect(result.data.public_url).toBe(`https://example.test/quote/${result.data.version.public_token}`)
  })

  it('errors before sending email when the public link cannot be activated', async () => {
    mockMarkEstimatePublicVersionSent.mockResolvedValue({
      ok: false,
      kind: 'server_error',
      message: 'Unable to lock quote',
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

    expect(mockMarkEstimatePublicVersionSent).toHaveBeenCalled()
    expect(mockSendGmailMessage).not.toHaveBeenCalled()
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: false,
      kind: 'server_error',
      message: 'Unable to lock quote',
    })
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

  it('attaches the generated quote PDF to the email', async () => {
    await submitCustomerSendMessage({
      ...baseParams,
      mode: 'test',
      version: {
        id: 'draft-1',
        snapshot_json: { document: assembledDocument },
      },
    } as never)

    expect(mockSendGmailMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        attachment: expect.objectContaining({
          filename: 'ACE-Painting_123-Main-St_2026-04-28_Living-Room-Quote.pdf',
          contentType: 'application/pdf',
          data: expect.any(Buffer),
        }),
      })
    )
  })

  it('uploads the generated quote PDF to Drive when the estimates folder is configured', async () => {
    process.env.GOOGLE_DRIVE_ESTIMATES_FOLDER_ID = 'folder-1'

    await submitCustomerSendMessage({
      ...baseParams,
      mode: 'test',
      version: {
        id: 'draft-1',
        snapshot_json: { document: assembledDocument },
      },
    } as never)

    expect(mockUploadDriveFile).toHaveBeenCalledWith(
      expect.objectContaining({
        folderId: 'folder-1',
        name: 'ACE-Painting_123-Main-St_2026-04-28_Living-Room-Quote.pdf',
        mimeType: 'application/pdf',
        data: expect.any(Buffer),
      })
    )
    expect(mockUpdateEstimatePublicVersionSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        versionId: 'draft-1',
        snapshot: expect.objectContaining({
          pdf: expect.objectContaining({
            drive_file_id: 'drive-1',
            drive_file_name: 'ACE-Painting_123-Main-St_2026-04-28_Living-Room-Quote.pdf',
            drive_web_view_link: 'https://drive.test/file/drive-1',
          }),
        }),
      })
    )
  })
})

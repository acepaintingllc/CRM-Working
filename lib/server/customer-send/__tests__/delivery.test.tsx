import { beforeEach, describe, expect, it, vi } from 'vitest'
import { submitCustomerSendMessage } from '../delivery'
import type {
  CustomerSendCopy,
  CustomerSendDraft,
  CustomerSendMode,
  EstimatePublicVersionRow,
} from '../types'

const {
  mockSendGmailMessage,
  mockUploadDriveFile,
  mockAppendEstimatePublicVersionPdf,
  mockMarkEstimatePublicVersionSent,
  mockSupersedeOlderPublicEstimateVersions,
  mockWriteEstimatePublicEvent,
} = vi.hoisted(() => ({
  mockSendGmailMessage: vi.fn(),
  mockUploadDriveFile: vi.fn(),
  mockAppendEstimatePublicVersionPdf: vi.fn(),
  mockMarkEstimatePublicVersionSent: vi.fn(),
  mockSupersedeOlderPublicEstimateVersions: vi.fn(),
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
  appendEstimatePublicVersionPdf: mockAppendEstimatePublicVersionPdf,
  markEstimatePublicVersionSent: mockMarkEstimatePublicVersionSent,
  supersedeOlderPublicEstimateVersions: mockSupersedeOlderPublicEstimateVersions,
  writeEstimatePublicEvent: mockWriteEstimatePublicEvent,
}))

type DeliveryParams = Parameters<typeof submitCustomerSendMessage>[0]

function buildDraft(overrides: Partial<CustomerSendDraft> = {}): CustomerSendDraft {
  return {
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
    ...overrides,
  }
}

function buildVersion(
  overrides: Partial<EstimatePublicVersionRow> = {}
): EstimatePublicVersionRow {
  return {
    id: 'draft-1',
    ...overrides,
  }
}

function buildDeliveryParams(
  overrides: Partial<Omit<DeliveryParams, 'mode' | 'version'>> & {
    mode?: CustomerSendMode
    version?: EstimatePublicVersionRow
  } = {}
): DeliveryParams {
  const defaultCopy: CustomerSendCopy = {
    sendNotice: 'Quote sent.',
    sendFailureMessage: 'Unable to send quote',
    lockFailureMessage: 'Unable to lock quote',
  }

  return {
    mode: overrides.mode ?? 'test',
    origin: 'https://example.test',
    orgId: 'org-1',
    userId: 'user-1',
    draft: buildDraft(),
    context: {
      estimate: {
        id: 'estimate-1',
        job_id: 'job-1',
        customer_id: 'customer-1',
        status: 'draft',
        version_name: 'Kitchen Quote',
        version_state: 'draft',
        version_kind: 'standard',
        version_sort_order: 1,
        created_at: '2026-04-01T00:00:00.000Z',
        updated_at: '2026-04-02T00:00:00.000Z',
      },
      job: {
        id: 'job-1',
        title: 'Kitchen',
        estimate_date: '2026-04-22',
        customer_name: 'Taylor',
        customer_email: 'customer@example.com',
        customer_phone: '',
        customer_address: '',
      },
      company: {
        business_name: 'ACE Painting',
        timezone: 'America/Chicago',
        main_phone: '',
        business_email: 'owner@example.com',
        address: '',
        website: '',
        sender_signature: 'Thanks,\nACE Painting',
        logo_url: '',
      },
      public_url: null,
    },
    version: buildVersion(),
    copy: defaultCopy,
    ...overrides,
  }
}

const persistedDocument = {
  meta: {
    estimate_id: 'estimate-1',
    version_name: 'Kitchen Quote',
    version_state: 'draft',
    flow_version: 'v2',
    title: 'Kitchen Quote',
    quote_date: '2026-04-22',
    sent_at: null,
    viewed_at: null,
    accepted_at: null,
    declined_at: null,
    status: 'draft',
    public_token: null,
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
    mockAppendEstimatePublicVersionPdf.mockReset()
    mockMarkEstimatePublicVersionSent.mockReset()
    mockSupersedeOlderPublicEstimateVersions.mockReset()
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
    mockAppendEstimatePublicVersionPdf.mockImplementation(async (params: { version: EstimatePublicVersionRow; pdf: Record<string, unknown> }) => ({
      ok: true,
      data: {
        id: 'draft-1',
        snapshot_json: {
          ...(params.version.snapshot_json as Record<string, unknown>),
          pdf: params.pdf,
        },
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
      ...buildDeliveryParams(),
      mode: 'test',
      version: buildVersion({
        snapshot_json: { document: persistedDocument },
      }),
    })

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
        snapshot_json: { document: persistedDocument },
      },
    }))

    const result = await submitCustomerSendMessage({
      ...buildDeliveryParams(),
      mode: 'send',
      version: buildVersion({
        public_token: null,
        snapshot_json: { document: persistedDocument },
      }),
    })

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
        bodyHtml: expect.stringContaining(`Your quote is ready: <a href="${publicUrl}">`),
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
        snapshot_json: { document: persistedDocument },
      },
    }))

    const result = await submitCustomerSendMessage({
      ...buildDeliveryParams(),
      mode: 'send',
      version: buildVersion({
        public_token: null,
        snapshot_json: { document: persistedDocument },
      }),
    })

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
          snapshot_json: { document: persistedDocument },
        }),
        delivery_error: 'Gmail not configured',
        document: persistedDocument,
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
      ...buildDeliveryParams(),
      mode: 'send',
      version: buildVersion({
        public_token: null,
        snapshot_json: { document: persistedDocument },
      }),
    })

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
      ...buildDeliveryParams(),
      mode: 'test',
      version: buildVersion({
        snapshot_json: { document: persistedDocument },
      }),
    })

    expect(result).toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Gmail not configured',
    })
  })

  it('passes cc and bcc recipients through to Gmail send', async () => {
    await submitCustomerSendMessage({
      ...buildDeliveryParams(),
      mode: 'test',
      draft: buildDraft({
        cc_email: 'team@example.com',
        bcc_email: 'owner@example.com',
      }),
      version: buildVersion({
        snapshot_json: { document: persistedDocument },
      }),
    })

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
      ...buildDeliveryParams(),
      mode: 'test',
      version: buildVersion({
        snapshot_json: { document: assembledDocument },
      }),
    })

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

  it('returns null and skips PDF generation when the snapshot has no document', async () => {
    const result = await submitCustomerSendMessage({
      ...buildDeliveryParams(),
      mode: 'test',
      version: buildVersion({
        snapshot_json: {},
      }),
    })

    expect(mockSendGmailMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        attachment: null,
      })
    )
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        document: null,
      }),
    })
  })

  it('falls back to the context estimate id when snapshot document meta is malformed', async () => {
    mockMarkEstimatePublicVersionSent.mockImplementation(async (params: { publicToken: string }) => ({
      ok: true,
      data: {
        id: 'draft-1',
        public_token: params.publicToken,
        snapshot_json: {
          document: {
            meta: {
              title: 'Kitchen Quote',
            },
          },
        },
      },
    }))

    const result = await submitCustomerSendMessage({
      ...buildDeliveryParams(),
      mode: 'send',
      version: buildVersion({
        public_token: null,
        snapshot_json: {
          document: {
            meta: {
              title: 'Kitchen Quote',
            },
          },
        },
      }),
    })

    expect(mockSendGmailMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        attachment: null,
      })
    )
    expect(mockSupersedeOlderPublicEstimateVersions).toHaveBeenCalledWith(
      expect.objectContaining({
        estimateId: 'estimate-1',
      })
    )
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        document: null,
      }),
    })
  })

  it('accepts legacy bare-document snapshot shapes for PDF generation', async () => {
    await submitCustomerSendMessage({
      ...buildDeliveryParams(),
      mode: 'test',
      version: buildVersion({
        snapshot_json: assembledDocument,
      }),
    })

    expect(mockSendGmailMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        attachment: expect.objectContaining({
          filename: 'ACE-Painting_123-Main-St_2026-04-28_Living-Room-Quote.pdf',
        }),
      })
    )
  })

  it('uploads the generated quote PDF to Drive when the estimates folder is configured', async () => {
    process.env.GOOGLE_DRIVE_ESTIMATES_FOLDER_ID = 'folder-1'

    await submitCustomerSendMessage({
      ...buildDeliveryParams(),
      mode: 'test',
      version: buildVersion({
        snapshot_json: { document: assembledDocument },
      }),
    })

    expect(mockUploadDriveFile).toHaveBeenCalledWith(
      expect.objectContaining({
        folderId: 'folder-1',
        name: 'ACE-Painting_123-Main-St_2026-04-28_Living-Room-Quote.pdf',
        mimeType: 'application/pdf',
        data: expect.any(Buffer),
      })
    )
    expect(mockAppendEstimatePublicVersionPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        version: expect.objectContaining({
          id: 'draft-1',
          snapshot_json: { document: assembledDocument },
        }),
        pdf: expect.objectContaining({
          drive_file_id: 'drive-1',
          drive_file_name: 'ACE-Painting_123-Main-St_2026-04-28_Living-Room-Quote.pdf',
          drive_web_view_link: 'https://drive.test/file/drive-1',
        }),
      })
    )
  })

  it('uses the persisted draft version document byte-for-byte for live send', async () => {
    mockMarkEstimatePublicVersionSent.mockImplementation(async (params: { publicToken: string }) => ({
      ok: true,
      data: {
        id: 'draft-1',
        public_token: params.publicToken,
        snapshot_json: { document: assembledDocument },
      },
    }))

    const result = await submitCustomerSendMessage({
      ...buildDeliveryParams(),
      mode: 'send',
      version: buildVersion({
        public_token: null,
        snapshot_json: { document: assembledDocument },
      }),
    })

    expect(mockSendGmailMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        attachment: expect.objectContaining({
          filename: 'ACE-Painting_123-Main-St_2026-04-28_Living-Room-Quote.pdf',
        }),
      })
    )
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        document: assembledDocument,
      }),
    })
  })

  it('appends PDF metadata without changing the persisted document', async () => {
    process.env.GOOGLE_DRIVE_ESTIMATES_FOLDER_ID = 'folder-1'

    await submitCustomerSendMessage({
      ...buildDeliveryParams(),
      mode: 'test',
      version: buildVersion({
        snapshot_json: { document: assembledDocument },
      }),
    })

    expect(mockAppendEstimatePublicVersionPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        version: expect.objectContaining({
          snapshot_json: { document: assembledDocument },
        }),
      })
    )
  })
})

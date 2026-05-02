import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  normalizeCustomerSendDraftScopeText: vi.fn(),
  sanitizeCustomerSendDraft: vi.fn(),
  buildCustomerSendDocument: vi.fn(),
  buildCustomerSendPublicMeta: vi.fn(),
  buildCustomerSendPublicUrl: vi.fn(),
  resolveCustomerSendVersionState: vi.fn(),
  saveCustomerSendDraftVersion: vi.fn(),
  submitCustomerSendMessage: vi.fn(),
  asText: vi.fn(),
}))

vi.mock('../draft', () => ({
  normalizeCustomerSendDraftScopeText: mocks.normalizeCustomerSendDraftScopeText,
  normalizeCustomerSendMode: (value: unknown) =>
    String(value ?? '').trim().toLowerCase() === 'send' ? 'send' : 'test',
  sanitizeCustomerSendDraft: mocks.sanitizeCustomerSendDraft,
}))

vi.mock('../document', () => ({
  buildCustomerSendDocument: mocks.buildCustomerSendDocument,
  buildCustomerSendPublicMeta: mocks.buildCustomerSendPublicMeta,
  buildCustomerSendPublicUrl: mocks.buildCustomerSendPublicUrl,
  resolveCustomerSendVersionState: mocks.resolveCustomerSendVersionState,
  asText: mocks.asText,
}))

vi.mock('../repository', () => ({
  saveCustomerSendDraftVersion: mocks.saveCustomerSendDraftVersion,
}))

vi.mock('../delivery', () => ({
  submitCustomerSendMessage: mocks.submitCustomerSendMessage,
}))

import {
  buildCustomerSendPageData,
  saveCustomerSendDraftMutation,
  submitCustomerSendMutation,
} from '../service'

const context = {
  estimate: {
    id: 'estimate-1',
    customer_id: 'customer-1',
  },
  job: {
    customer_name: 'Taylor',
    customer_email: 'customer@example.com',
    customer_phone: '555-1212',
    customer_address: '123 Main',
  },
  customer: {
    name: 'Taylor',
    email: 'customer@example.com',
  },
  company: {
    business_name: 'ACE Painting',
  },
  settings: {
    default_template_key: 'friendly',
  },
  inputs: {
    rooms: [],
    room_wall_scopes: [],
    segments: [],
    wall_segments: [],
    ceiling_segments: [],
    room_ceiling_scopes: [],
    ceiling_scope_segments: [],
    room_trim_scopes: [],
    room_door_scopes: [],
    access_fees: [],
    trim_items: [],
    other: [],
    jobsettings: {},
  },
  catalogs: null,
  pricing_summary: {
    finalTotal: 1200,
  },
  latest_public_version: {
    id: 'live-1',
    status: 'sent',
    public_token: 'live-token',
  },
  latest_sent_version: null,
  latest_draft_version: {
    id: 'draft-1',
    status: 'draft',
  },
  public_url: 'https://example.test/quote/fallback-token',
  public_versions: [{ id: 'draft-1', status: 'draft' }],
} as never

describe('customer send service', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset()
    }

    mocks.asText.mockImplementation((value: unknown) => (value == null ? '' : String(value).trim()))
    mocks.resolveCustomerSendVersionState.mockReturnValue({
      latestDraft: { id: 'draft-1', version_number: 2, status: 'draft' },
      latestVersion: { id: 'draft-1', version_number: 2, status: 'draft' },
    })
    mocks.sanitizeCustomerSendDraft.mockImplementation((value: unknown) => ({
      sanitized: true,
      ...(value as Record<string, unknown>),
    }))
    mocks.normalizeCustomerSendDraftScopeText.mockReturnValue({
      ok: true,
      data: {
        to_email: 'customer@example.com',
        scope_text_edits: {
          walls: '',
          ceilings: '',
          trim: '',
          doors: '',
          cabinets: '',
          other: '',
        },
      },
    })
    mocks.buildCustomerSendPublicMeta.mockReturnValue({
      status: 'draft',
      public_token: null,
    })
    mocks.buildCustomerSendDocument.mockReturnValue({
      ok: true,
      data: {
        meta: {
          title: 'Kitchen Quote',
        },
      },
    })
    mocks.buildCustomerSendPublicUrl.mockReturnValue('https://example.test/quote/live-token')
    mocks.saveCustomerSendDraftVersion.mockResolvedValue({
      ok: true,
      data: {
        id: 'draft-1',
        status: 'draft',
        public_token: 'live-token',
        snapshot_json: {
          document: {
            saved: true,
          },
        },
      },
    })
    mocks.submitCustomerSendMessage.mockResolvedValue({
      ok: true,
      data: {
        mode: 'send',
        public_url: 'https://example.test/quote/live-token',
        version: {
          id: 'draft-1',
          status: 'sent',
          public_token: 'live-token',
        },
        document: {
          saved: true,
        },
      },
    })
  })

  it('builds page data from the latest normalized draft, document, and public version state', () => {
    const result = buildCustomerSendPageData({
      origin: 'https://example.test',
      context,
    })

    expect(mocks.sanitizeCustomerSendDraft).toHaveBeenCalledWith({})
    expect(mocks.normalizeCustomerSendDraftScopeText).toHaveBeenCalledWith({
      context,
      draft: {
        sanitized: true,
      },
    })
    expect(mocks.buildCustomerSendDocument).toHaveBeenCalledWith({
      context,
      draft: expect.objectContaining({ to_email: 'customer@example.com' }),
      publicMeta: {
        status: 'draft',
        public_token: null,
      },
    })
    expect(mocks.buildCustomerSendPublicUrl).toHaveBeenCalledWith({
      origin: 'https://example.test',
      version: { id: 'draft-1', version_number: 2, status: 'draft' },
      fallback: 'https://example.test/quote/fallback-token',
    })
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        public_url: 'https://example.test/quote/live-token',
        version: { id: 'draft-1', version_number: 2, status: 'draft' },
        document: { meta: { title: 'Kitchen Quote' } },
      }),
    })
  })

  it('saves a recomputed normalized draft before returning the public url contract', async () => {
    const result = await saveCustomerSendDraftMutation({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      body: {
        draft: {
          to_email: ' customer@example.com ',
        },
      },
      context,
    })

    expect(mocks.sanitizeCustomerSendDraft).toHaveBeenCalledWith({
      draft: {
        to_email: ' customer@example.com ',
      },
    })
    expect(mocks.buildCustomerSendPublicMeta).toHaveBeenCalledWith(
      { id: 'draft-1', version_number: 2, status: 'draft' },
      'draft'
    )
    expect(mocks.buildCustomerSendDocument).toHaveBeenCalledWith({
      context,
      draft: expect.objectContaining({ to_email: 'customer@example.com' }),
      publicMeta: {
        status: 'draft',
        public_token: null,
      },
    })
    expect(mocks.saveCustomerSendDraftVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        estimateId: 'estimate-1',
        userId: 'user-1',
        customerId: 'customer-1',
        draft: expect.objectContaining({ to_email: 'customer@example.com' }),
        document: { meta: { title: 'Kitchen Quote' } },
      })
    )
    expect(result).toEqual({
      ok: true,
      data: {
        public_url: 'https://example.test/quote/live-token',
        version: {
          id: 'draft-1',
          status: 'draft',
          public_token: 'live-token',
          snapshot_json: {
            document: {
              saved: true,
            },
          },
        },
        document: {
          saved: true,
        },
      },
    })
  })

  it('rejects submit when the normalized draft has no customer email', async () => {
    mocks.normalizeCustomerSendDraftScopeText.mockReturnValueOnce({
      ok: true,
      data: {
        to_email: '',
        scope_text_edits: {
          walls: '',
          ceilings: '',
          trim: '',
          doors: '',
          cabinets: '',
          other: '',
        },
      },
    })

    const result = await submitCustomerSendMutation({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      body: { mode: 'send', draft: {} },
      context,
      copy: {
        sendNotice: 'Quote sent.',
        sendFailureMessage: 'Unable to send quote',
        lockFailureMessage: 'Unable to lock quote',
      },
    })

    expect(result).toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Customer email is required',
    })
    expect(mocks.saveCustomerSendDraftVersion).not.toHaveBeenCalled()
    expect(mocks.submitCustomerSendMessage).not.toHaveBeenCalled()
  })

  it('persists the latest normalized draft before send and returns the delivery result', async () => {
    const result = await submitCustomerSendMutation({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      body: {
        mode: 'send',
        draft: {
          to_email: 'customer@example.com',
          title: 'Kitchen Quote',
        },
      },
      context,
      copy: {
        sendNotice: 'Quote sent.',
        sendFailureMessage: 'Unable to send quote',
        lockFailureMessage: 'Unable to lock quote',
      },
    })

    expect(mocks.saveCustomerSendDraftVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({ to_email: 'customer@example.com' }),
        document: { meta: { title: 'Kitchen Quote' } },
      })
    )
    expect(mocks.submitCustomerSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'send',
        origin: 'https://example.test',
        orgId: 'org-1',
        userId: 'user-1',
        draft: expect.objectContaining({ to_email: 'customer@example.com' }),
        context,
        version: {
          id: 'draft-1',
          status: 'draft',
          public_token: 'live-token',
          snapshot_json: {
            document: {
              saved: true,
            },
          },
        },
      })
    )
    expect(result).toEqual({
      ok: true,
      data: {
        mode: 'send',
        public_url: 'https://example.test/quote/live-token',
        version: {
          id: 'draft-1',
          status: 'sent',
          public_token: 'live-token',
        },
        document: {
          saved: true,
        },
      },
    })
  })
})

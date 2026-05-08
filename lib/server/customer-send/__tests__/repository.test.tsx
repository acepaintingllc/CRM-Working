import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  appendEstimatePublicVersionPdf,
  saveCustomerSendDraftVersion,
  supersedeOlderPublicEstimateVersions,
  upgradeCustomerSendLegacyVersionSnapshot,
  updateEstimatePublicVersionSnapshot,
} from '../repository'
import type { CustomerEstimateDocument } from '@/lib/customer-estimates/types'
import { buildCustomerSendPersistedSnapshot } from '../types'

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/server/org', () => ({
  supabaseAdmin: {
    from: mockFrom,
  },
}))

function createUpdateChain(result: unknown) {
  const chain = {
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
  }
  chain.eq.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  return chain
}

function createInsertChain(result: unknown) {
  const chain = {
    select: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
  }
  chain.select.mockReturnValue(chain)
  return chain
}

function createSupersedeUpdateChain(result: unknown) {
  const chain = {
    eq: vi.fn(),
    neq: vi.fn(),
    in: vi.fn(),
    select: vi.fn(),
  }
  chain.eq.mockReturnValue(chain)
  chain.neq.mockReturnValue(chain)
  chain.in.mockReturnValue(chain)
  chain.select.mockResolvedValue(result)
  return chain
}

const persistedDocument: CustomerEstimateDocument = {
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
  company: {
    business_name: 'ACE Painting',
    timezone: 'America/Chicago',
    main_phone: '',
    business_email: 'owner@example.com',
    address: '',
    website: '',
    sender_signature: '',
    logo_url: '',
  },
  customer: {
    name: 'Taylor',
    email: 'customer@example.com',
    phone: '',
    address: '',
    street: '',
    city: '',
    state: '',
    zip: '',
  },
  intro_paragraph: '',
  closing_paragraph: '',
  quote_validity_days: 30,
  deposit_language: '',
  card_fee_note: '',
  quote_rows: [],
  scopes: [],
  total: null,
  terms: [],
  terms_sections: null,
  source_meta: {
    company: {
      business_name: false,
      main_phone: false,
      business_email: false,
      address: false,
      website: false,
      sender_signature: false,
      logo_url: false,
    },
    settings: {
      quote_validity_days: false,
      terms_text: false,
      terms_sections: false,
    },
    overrides: {
      title: false,
      intro_paragraph: false,
      closing_paragraph: false,
      deposit_language: false,
      card_fee_note: false,
    },
  },
  header: {
    company_name: 'ACE Painting',
    contact_lines: [],
    logo_url: '',
    document_label: 'QUOTE',
    quote_date_label: '4/22/26',
  },
  customer_block: {
    lines: [],
  },
  pricing_block: {
    rows: [],
    total: null,
    footer_note: '',
  },
  terms_page: {
    title: 'Terms',
    sections: [],
  },
  assembly_meta: {
    missing_company_fields: [],
    missing_payment_fields: [],
    missing_legal_fields: [],
    used_placeholder_fallbacks: false,
    used_explicit_terms_text: false,
  },
}

describe('customer send repository', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('reuses the latest draft row and preserves draft-linked metadata', async () => {
    const updateSpy = vi.fn(() =>
      createUpdateChain({
        data: { id: 'draft-1', version_number: 2, snapshot_json: { document: persistedDocument } },
        error: null,
      })
    )
    const eventInsertSpy = vi.fn().mockResolvedValue({ error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return { update: updateSpy }
      }
      if (table === 'estimate_public_events') {
        return { insert: eventInsertSpy }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await saveCustomerSendDraftVersion({
      orgId: 'org-1',
      estimateId: 'estimate-1',
      customerId: 'customer-1',
      userId: 'user-1',
      draft: {
        to_email: 'customer@example.com',
        cc_email: '',
        bcc_email: '',
        subject: 'Quote ready',
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
      document: persistedDocument,
      latestDraft: {
        id: 'draft-1',
        version_number: 2,
        public_token: 'existing-token',
        acceptance_json: { signed: true },
        sent_at: '2026-04-01T00:00:00.000Z',
        viewed_at: null,
        accepted_at: null,
        declined_at: null,
        locked_at: '2026-04-01T00:00:00.000Z',
      },
      latestVersion: {
        id: 'draft-1',
        version_number: 2,
      },
    })

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        version_number: 2,
        public_token: 'existing-token',
        draft_json: null,
        snapshot_json: expect.objectContaining({
          artifact_kind: 'customer_estimate_artifact',
          artifact_version: 1,
          document: persistedDocument,
          draft: expect.objectContaining({
            to_email: 'customer@example.com',
          }),
        }),
        acceptance_json: { signed: true },
        sent_at: '2026-04-01T00:00:00.000Z',
        locked_at: '2026-04-01T00:00:00.000Z',
        status: 'draft',
      })
    )
    expect(eventInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'draft_saved',
        estimate_public_version_id: 'draft-1',
      })
    )
    expect(result.ok).toBe(true)
  })

  it('increments the version number when saving a new draft version', async () => {
    const insertSpy = vi.fn(() =>
      createInsertChain({
        data: { id: 'draft-2', version_number: 4, snapshot_json: { document: persistedDocument } },
        error: null,
      })
    )
    const eventInsertSpy = vi.fn().mockResolvedValue({ error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return { insert: insertSpy }
      }
      if (table === 'estimate_public_events') {
        return { insert: eventInsertSpy }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await saveCustomerSendDraftVersion({
      orgId: 'org-1',
      estimateId: 'estimate-1',
      customerId: 'customer-1',
      userId: 'user-1',
      draft: {
        to_email: 'customer@example.com',
        cc_email: '',
        bcc_email: '',
        subject: '',
        body: '',
        template_key: '',
        title: '',
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
        quote_validity_days: null,
        deposit_language: '',
        card_fee_note: '',
      },
      document: persistedDocument,
      latestDraft: null,
      latestVersion: {
        id: 'sent-3',
        version_number: 3,
      },
    })

    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        version_number: 4,
        draft_json: null,
        snapshot_json: expect.objectContaining({
          artifact_kind: 'customer_estimate_artifact',
          artifact_version: 1,
          document: persistedDocument,
          draft: expect.objectContaining({
            to_email: 'customer@example.com',
          }),
        }),
        public_token: null,
        acceptance_json: null,
      })
    )
    expect(result.ok).toBe(true)
  })

  it('creates a new draft version instead of mutating the latest sent version', async () => {
    const insertSpy = vi.fn(() =>
      createInsertChain({
        data: { id: 'draft-4', version_number: 4, status: 'draft', snapshot_json: { document: persistedDocument } },
        error: null,
      })
    )
    const eventInsertSpy = vi.fn().mockResolvedValue({ error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return { insert: insertSpy }
      }
      if (table === 'estimate_public_events') {
        return { insert: eventInsertSpy }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await saveCustomerSendDraftVersion({
      orgId: 'org-1',
      estimateId: 'estimate-1',
      customerId: 'customer-1',
      userId: 'user-1',
      draft: {
        to_email: 'customer@example.com',
        cc_email: '',
        bcc_email: '',
        subject: '',
        body: '',
        template_key: '',
        title: '',
        intro_paragraph: '',
        closing_paragraph: '',
        terms_text: '',
        scope_text_edits: {
          walls: '',
          ceilings: '',
          trim: '',
          doors: '',
          drywall: '',
          cabinets: '',
          other: '',
        },
        quote_validity_days: null,
        deposit_language: '',
        card_fee_note: '',
      },
      document: persistedDocument,
      latestDraft: null,
      latestVersion: {
        id: 'sent-3',
        version_number: 3,
        status: 'sent',
        snapshot_json: { document: { meta: { estimate_id: 'estimate-1', title: 'Sent Quote' } } },
      },
    })

    expect(insertSpy).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        id: 'draft-4',
        version_number: 4,
        status: 'draft',
      }),
    })
  })

  it('appends PDF metadata without replacing snapshot_json.document', async () => {
    const updateSpy = vi.fn(() =>
      createUpdateChain({
        data: {
          id: 'draft-1',
          snapshot_json: {
            document: persistedDocument,
            draft: {
              to_email: 'customer@example.com',
            },
            pdf: {
              drive_file_id: 'drive-1',
              drive_file_name: 'quote.pdf',
              drive_web_view_link: 'https://drive.test/file/drive-1',
              filename: 'quote.pdf',
              mime_type: 'application/pdf',
              saved_at: '2026-05-01T00:00:00.000Z',
            },
          },
        },
        error: null,
      })
    )

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return { update: updateSpy }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await appendEstimatePublicVersionPdf({
      orgId: 'org-1',
      version: {
        id: 'draft-1',
        snapshot_json: {
          document: persistedDocument,
          draft: {
            to_email: 'customer@example.com',
          },
        },
      },
      pdf: {
        drive_file_id: 'drive-1',
        drive_file_name: 'quote.pdf',
        drive_web_view_link: 'https://drive.test/file/drive-1',
        filename: 'quote.pdf',
        mime_type: 'application/pdf',
        saved_at: '2026-05-01T00:00:00.000Z',
      },
    })

    expect(updateSpy).toHaveBeenCalledWith({
      snapshot_json: expect.objectContaining({
        artifact_kind: 'customer_estimate_artifact',
        artifact_version: 1,
        document: expect.objectContaining({
          meta: expect.objectContaining({
            estimate_id: 'estimate-1',
            title: 'Kitchen Quote',
          }),
        }),
        draft: {
          to_email: 'customer@example.com',
        },
        pdf: {
          drive_file_id: 'drive-1',
          drive_file_name: 'quote.pdf',
          drive_web_view_link: 'https://drive.test/file/drive-1',
          filename: 'quote.pdf',
          mime_type: 'application/pdf',
          saved_at: '2026-05-01T00:00:00.000Z',
        },
      }),
    })
    expect(result.ok).toBe(true)
  })

  it('normalizes legacy bare-document snapshots when appending PDF metadata', async () => {
    const updateSpy = vi.fn(() =>
      createUpdateChain({
        data: {
          id: 'draft-1',
          snapshot_json: {
            document: persistedDocument,
            draft: {
              to_email: 'customer@example.com',
            },
            pdf: {
              drive_file_id: 'drive-1',
              drive_file_name: 'quote.pdf',
              drive_web_view_link: 'https://drive.test/file/drive-1',
              filename: 'quote.pdf',
              mime_type: 'application/pdf',
              saved_at: '2026-05-01T00:00:00.000Z',
            },
          },
        },
        error: null,
      })
    )

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return { update: updateSpy }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await appendEstimatePublicVersionPdf({
      orgId: 'org-1',
      version: {
        id: 'draft-1',
        status: 'draft',
        snapshot_json: {
          ...persistedDocument,
          draft: {
            to_email: 'customer@example.com',
          },
        },
      },
      pdf: {
        drive_file_id: 'drive-1',
        drive_file_name: 'quote.pdf',
        drive_web_view_link: 'https://drive.test/file/drive-1',
        filename: 'quote.pdf',
        mime_type: 'application/pdf',
        saved_at: '2026-05-01T00:00:00.000Z',
      },
    })

    expect(updateSpy).toHaveBeenCalledWith({
      snapshot_json: expect.objectContaining({
        artifact_kind: 'customer_estimate_artifact',
        artifact_version: 1,
        document: expect.objectContaining({
          meta: expect.objectContaining({
            estimate_id: 'estimate-1',
            title: 'Kitchen Quote',
          }),
        }),
        draft: {
          to_email: 'customer@example.com',
        },
        pdf: {
          drive_file_id: 'drive-1',
          drive_file_name: 'quote.pdf',
          drive_web_view_link: 'https://drive.test/file/drive-1',
          filename: 'quote.pdf',
          mime_type: 'application/pdf',
          saved_at: '2026-05-01T00:00:00.000Z',
        },
      }),
    })
    expect(result.ok).toBe(true)
  })

  it('creates a new draft row when a non-draft latestDraft is passed defensively', async () => {
    const insertSpy = vi.fn(() =>
      createInsertChain({
        data: { id: 'draft-5', version_number: 5, status: 'draft', snapshot_json: { document: persistedDocument } },
        error: null,
      })
    )
    const eventInsertSpy = vi.fn().mockResolvedValue({ error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return { insert: insertSpy, update: vi.fn() }
      }
      if (table === 'estimate_public_events') {
        return { insert: eventInsertSpy }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await saveCustomerSendDraftVersion({
      orgId: 'org-1',
      estimateId: 'estimate-1',
      customerId: 'customer-1',
      userId: 'user-1',
      draft: {
        to_email: 'customer@example.com',
        cc_email: '',
        bcc_email: '',
        subject: '',
        body: '',
        template_key: '',
        title: '',
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
        quote_validity_days: null,
        deposit_language: '',
        card_fee_note: '',
      },
      document: persistedDocument,
      latestDraft: {
        id: 'sent-4',
        version_number: 4,
        status: 'sent',
        snapshot_json: { document: persistedDocument },
      },
      latestVersion: {
        id: 'sent-4',
        version_number: 4,
        status: 'sent',
      },
    })

    expect(insertSpy).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(true)
  })

  it('upgrades a legacy draft snapshot into the canonical wrapper shape', async () => {
    const updateSpy = vi.fn(() =>
      createUpdateChain({
        data: {
          id: 'draft-legacy',
          status: 'draft',
          snapshot_json: {
            document: persistedDocument,
            draft: {
              to_email: 'customer@example.com',
            },
          },
        },
        error: null,
      })
    )

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return { update: updateSpy }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await upgradeCustomerSendLegacyVersionSnapshot({
      orgId: 'org-1',
      version: {
        id: 'draft-legacy',
        status: 'draft',
        snapshot_json: persistedDocument,
      },
      document: persistedDocument,
      draft: {
        to_email: 'customer@example.com',
        cc_email: '',
        bcc_email: '',
        subject: '',
        body: '',
        template_key: '',
        title: '',
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
        quote_validity_days: null,
        deposit_language: '',
        card_fee_note: '',
      },
    })

    expect(updateSpy).toHaveBeenCalledWith({
      draft_json: null,
      snapshot_json: expect.objectContaining({
        artifact_kind: 'customer_estimate_artifact',
        artifact_version: 1,
        document: persistedDocument,
        draft: expect.objectContaining({
          to_email: 'customer@example.com',
        }),
      }),
    })
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        id: 'draft-legacy',
        status: 'draft',
      }),
    })
  })

  it('does not upgrade legacy sent snapshots through the draft preview path', async () => {
    const result = await upgradeCustomerSendLegacyVersionSnapshot({
      orgId: 'org-1',
      version: {
        id: 'sent-legacy',
        status: 'sent',
        snapshot_json: persistedDocument,
      },
      document: persistedDocument,
      draft: {
        to_email: 'customer@example.com',
        cc_email: '',
        bcc_email: '',
        subject: '',
        body: '',
        template_key: '',
        title: '',
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
        quote_validity_days: null,
        deposit_language: '',
        card_fee_note: '',
      },
    })

    expect(result).toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Sent quote snapshots must be migrated before public rendering.',
    })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('rejects replacing the persisted document on a non-draft version', async () => {
    const result = await updateEstimatePublicVersionSnapshot({
      orgId: 'org-1',
      version: {
        id: 'sent-1',
        status: 'sent',
        snapshot_json: {
          document: persistedDocument,
        },
      },
      snapshot: buildCustomerSendPersistedSnapshot({
        document: {
          ...persistedDocument,
          meta: {
            ...persistedDocument.meta,
            title: 'Mutated Quote',
          },
        },
        draft: {
          to_email: 'customer@example.com',
          cc_email: '',
          bcc_email: '',
          subject: 'Quote ready',
          body: '',
          template_key: 'default',
          title: 'Mutated Quote',
          intro_paragraph: '',
          closing_paragraph: '',
          terms_text: '',
          scope_text_edits: {},
          quote_validity_days: 30,
          deposit_language: '',
          card_fee_note: '',
        },
      }),
    })

    expect(result).toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Sent quote documents are immutable and cannot be replaced.',
    })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('supersedes older sent and viewed public versions for the same estimate', async () => {
    const updateChain = createSupersedeUpdateChain({
      data: [
        { id: 'old-sent' },
        { id: 'old-viewed' },
      ],
      error: null,
    })
    const updateSpy = vi.fn(() => updateChain)
    const eventInsertSpy = vi.fn().mockResolvedValue({ error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return { update: updateSpy }
      }
      if (table === 'estimate_public_events') {
        return { insert: eventInsertSpy }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await supersedeOlderPublicEstimateVersions({
      orgId: 'org-1',
      estimateId: 'estimate-1',
      currentVersionId: 'new-version',
      supersededAt: '2026-04-29T10:00:00.000Z',
      userId: 'user-1',
    })

    expect(updateSpy).toHaveBeenCalledWith({
      status: 'superseded',
      locked_at: '2026-04-29T10:00:00.000Z',
    })
    expect(updateChain.eq).toHaveBeenCalledWith('org_id', 'org-1')
    expect(updateChain.eq).toHaveBeenCalledWith('estimate_id', 'estimate-1')
    expect(updateChain.neq).toHaveBeenCalledWith('id', 'new-version')
    expect(updateChain.in).toHaveBeenCalledWith('status', ['sent', 'viewed'])
    expect(eventInsertSpy).toHaveBeenCalledTimes(2)
    expect(eventInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        estimate_public_version_id: 'old-sent',
        event_type: 'superseded',
        actor_type: 'staff',
        created_by: 'user-1',
      })
    )
    expect(result).toEqual({
      ok: true,
      data: { supersededIds: ['old-sent', 'old-viewed'] },
    })
  })
})

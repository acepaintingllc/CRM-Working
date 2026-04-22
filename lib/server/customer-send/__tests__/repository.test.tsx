import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveCustomerSendDraftVersion } from '../repository'

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

describe('customer send repository', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('reuses the latest draft row and preserves draft-linked metadata', async () => {
    const updateSpy = vi.fn(() =>
      createUpdateChain({
        data: { id: 'draft-1', version_number: 2, snapshot_json: { document: true } },
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
      document: { document: true },
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
        data: { id: 'draft-2', version_number: 4, snapshot_json: { document: true } },
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
      document: { document: true },
      latestDraft: null,
      latestVersion: {
        id: 'sent-3',
        version_number: 3,
      },
    })

    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        version_number: 4,
        public_token: null,
        acceptance_json: null,
      })
    )
    expect(result.ok).toBe(true)
  })
})

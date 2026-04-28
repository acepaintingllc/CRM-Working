import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  normalizeCustomerSendDraftScopeText,
  sanitizeCustomerSendDraft,
} from '../draft'

const { mockBuildCustomerSendDocument } = vi.hoisted(() => ({
  mockBuildCustomerSendDocument: vi.fn(),
}))

vi.mock('../document', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../document')>()
  return {
    ...actual,
    buildCustomerSendDocument: mockBuildCustomerSendDocument,
  }
})

describe('customer send draft helpers', () => {
  beforeEach(() => {
    mockBuildCustomerSendDocument.mockReset()
  })

  it('sanitizes nested draft payloads into the canonical server draft shape', () => {
    expect(
      sanitizeCustomerSendDraft({
        draft: {
          to_email: ' customer@example.com ',
          cc_email: ' cc@example.com ',
          quote_validity_days: '45',
          scope_text_edits: {
            walls: ' Paint walls ',
          },
        },
      })
    ).toEqual({
      to_email: 'customer@example.com',
      cc_email: 'cc@example.com',
      bcc_email: '',
      subject: '',
      body: '',
      template_key: '',
      title: '',
      intro_paragraph: '',
      closing_paragraph: '',
      terms_text: '',
      scope_text_edits: {
        walls: 'Paint walls',
        ceilings: '',
        trim: '',
        doors: '',
        cabinets: '',
        other: '',
      },
      quote_validity_days: 45,
      deposit_language: '',
      card_fee_note: '',
    })
  })

  it('collapses scope wording edits that only restate the baseline customer copy', () => {
    mockBuildCustomerSendDocument.mockReturnValue({
      ok: true,
      data: {
        scopes: [
          { key: 'walls', text: 'Paint walls using premium coating.' },
          { key: 'trim', text: 'Prep and paint trim.' },
        ],
      },
    })

    const normalized = normalizeCustomerSendDraftScopeText({
      context: {
        public_versions: [],
      } as never,
      draft: sanitizeCustomerSendDraft({
        scope_text_edits: {
          walls: 'Paint walls with premium coating.',
          trim: 'Custom trim wording',
        },
      }),
    })

    expect(normalized.ok).toBe(true)
    if (!normalized.ok) return

    expect(normalized.data.scope_text_edits).toEqual({
      walls: '',
      ceilings: '',
      trim: 'Custom trim wording',
      doors: '',
      cabinets: '',
      other: '',
    })
  })

  it('collapses stale generated scope wording that predates product labels', () => {
    mockBuildCustomerSendDocument.mockReturnValue({
      ok: true,
      data: {
        scopes: [
          {
            key: 'walls',
            text: 'Prep and paint 2 coats on walls in Living Room, using SW Duration Home.',
          },
          {
            key: 'ceilings',
            text: 'Prep and paint 2 coats on ceilings in Living Room, using SW ProMar Ceiling.',
          },
        ],
      },
    })

    const normalized = normalizeCustomerSendDraftScopeText({
      context: {
        public_versions: [],
      } as never,
      draft: sanitizeCustomerSendDraft({
        scope_text_edits: {
          walls: 'Prep and paint 2 coats on walls in Living Room.',
          ceilings: 'Customer-approved ceiling wording.',
        },
      }),
    })

    expect(normalized.ok).toBe(true)
    if (!normalized.ok) return

    expect(normalized.data.scope_text_edits).toEqual({
      walls: '',
      ceilings: 'Customer-approved ceiling wording.',
      trim: '',
      doors: '',
      cabinets: '',
      other: '',
    })
  })
})

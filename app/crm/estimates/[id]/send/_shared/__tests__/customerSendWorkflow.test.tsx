import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildCustomerSendComposerDraft,
  customerSendUrl,
  deriveCustomerSendLabels,
  useCustomerSendWorkflow,
} from '../customerSendWorkflow'

const {
  loadCustomerSendPage,
  saveCustomerSendDraft,
  submitCustomerSend,
} = vi.hoisted(() => ({
  loadCustomerSendPage: vi.fn(),
  saveCustomerSendDraft: vi.fn(),
  submitCustomerSend: vi.fn(),
}))

vi.mock('@/lib/quotes/client', () => ({
  loadCustomerSendPage,
  saveCustomerSendDraft,
  submitCustomerSend,
}))

const basePayload = {
  estimate: {},
  job: {
    customer_email: 'customer@example.com',
    estimate_date: '2026-04-22',
  },
  customer: {
    name: 'Taylor',
    email: 'customer@example.com',
  },
  company: {
    business_name: 'ACE Painting',
  },
  inputs: {},
  catalogs: null,
  pricing_summary: { finalTotal: 1200 },
  settings: {
    default_template_key: 'friendly',
  },
  draft: {
    template_key: 'default',
    scope_text_edits: {
      walls: 'Custom walls copy',
    },
  },
  version: {
    status: 'draft',
  },
  public_url: null,
  document: {
    meta: {
      title: 'Kitchen Quote',
      flow_version: 'v2',
    },
    customer: {
      name: 'Taylor',
      email: 'customer@example.com',
    },
    quote_validity_days: 90,
  },
  versions: [],
}

describe('customerSendWorkflow', () => {
  beforeEach(() => {
    loadCustomerSendPage.mockReset()
    saveCustomerSendDraft.mockReset()
    submitCustomerSend.mockReset()
  })

  it('builds draft defaults and derives quote labels from flow metadata', () => {
    const draft = buildCustomerSendComposerDraft(basePayload as never, basePayload.draft, true)

    expect(draft.to_email).toBe('customer@example.com')
    expect(draft.scope_text_edits.walls).toBe('Custom walls copy')
    expect(customerSendUrl('estimate-1', 'v2')).toBe('/api/quotes/estimate-1/customer-send?v2=1')
    expect(deriveCustomerSendLabels(basePayload as never).document).toBe('Quote')
  })

  it('derives estimate labels when the flow is not the quote alias', () => {
    expect(
      deriveCustomerSendLabels({
        ...basePayload,
        document: {
          ...basePayload.document,
          meta: {
            ...basePayload.document.meta,
            flow_version: 'estimate',
          },
        },
      } as never).document
    ).toBe('Estimate')
  })

  it('loads, saves, and submits through the shared workflow hook', async () => {
    loadCustomerSendPage.mockResolvedValue(basePayload)
    saveCustomerSendDraft.mockResolvedValue({
      public_url: 'https://example.test/quote',
      version: { status: 'draft' },
    })
    submitCustomerSend.mockResolvedValue({
      public_url: 'https://example.test/quote',
      version: { status: 'sent', sent_at: '2026-04-22T12:00:00.000Z' },
    })

    const { result } = renderHook(() =>
      useCustomerSendWorkflow({
        estimateId: 'estimate-1',
        catalogSource: 'v2' as const,
        buildForm: buildCustomerSendComposerDraft,
        buildDocument: (data) => data.document,
        draftPayload: (form) => form,
        loadErrorMessage: 'Unable to load quote send page',
      })
    )

    await waitFor(() => {
      expect(result.current.form?.title).toBe('Kitchen Quote')
    })

    await act(async () => {
      await result.current.persistDraft()
    })

    expect(saveCustomerSendDraft).toHaveBeenCalledWith(
      '/api/quotes/estimate-1/customer-send?v2=1',
      expect.objectContaining({ title: 'Kitchen Quote' })
    )

    await act(async () => {
      await result.current.submit('send')
    })

    expect(submitCustomerSend).toHaveBeenCalledWith(
      '/api/quotes/estimate-1/customer-send?v2=1',
      expect.objectContaining({ mode: 'send' })
    )
    expect(result.current.publicUrl).toBe('https://example.test/quote')
    expect(result.current.message).toBe('Quote sent.')
  })
})

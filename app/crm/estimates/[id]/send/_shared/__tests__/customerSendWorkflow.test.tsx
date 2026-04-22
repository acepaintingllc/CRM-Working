import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { quoteRouteFamily } from '@/app/crm/estimates/[id]/estimateRouteFamily'
import {
  buildCustomerSendComposerDraft,
  customerSendUrl,
  deriveCustomerSendLabels,
  normalizeCustomerSendVersion,
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

vi.mock('@/lib/customer-send/client', () => ({
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
    expect(customerSendUrl('estimate-1', 'v2')).toBe('/api/estimates/estimate-1/customer-send?v2=1')
    expect(customerSendUrl('estimate-1', 'v2', quoteRouteFamily)).toBe(
      '/api/quotes/estimate-1/customer-send?v2=1'
    )
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
      '/api/estimates/estimate-1/customer-send?v2=1',
      expect.objectContaining({ title: 'Kitchen Quote' })
    )

    await act(async () => {
      await result.current.submit('send')
    })

    expect(submitCustomerSend).toHaveBeenCalledWith(
      '/api/estimates/estimate-1/customer-send?v2=1',
      expect.objectContaining({ mode: 'send' })
    )
    expect(result.current.publicUrl).toBe('https://example.test/quote')
    expect(result.current.message).toBe('Quote sent.')
    expect(result.current.isLive).toBe(true)
    expect(result.current.hasLiveLink).toBe(true)
    expect(result.current.version).toEqual({
      status: 'sent',
      sent_at: '2026-04-22T12:00:00.000Z',
      viewed_at: null,
      accepted_at: null,
      declined_at: null,
      public_token: null,
    })
  })

  it('uses quote route overrides when the alias family is provided', async () => {
    loadCustomerSendPage.mockResolvedValue(basePayload)

    const { result } = renderHook(() =>
      useCustomerSendWorkflow({
        estimateId: 'estimate-1',
        catalogSource: 'v2' as const,
        routeFamily: quoteRouteFamily,
        buildForm: buildCustomerSendComposerDraft,
        buildDocument: (data) => data.document,
        draftPayload: (form) => form,
        loadErrorMessage: 'Unable to load quote send page',
      })
    )

    await waitFor(() => {
      expect(result.current.form?.title).toBe('Kitchen Quote')
    })

    expect(loadCustomerSendPage).toHaveBeenCalledWith(
      '/api/quotes/estimate-1/customer-send?v2=1'
    )
  })

  it('distinguishes test send from live send state transitions', async () => {
    loadCustomerSendPage.mockResolvedValue(basePayload)
    submitCustomerSend.mockResolvedValue({
      version: { viewed_at: '2026-04-23T12:00:00.000Z' },
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
      await result.current.submit('test')
    })

    expect(result.current.message).toBe('Test message sent.')
    expect(result.current.isLive).toBe(false)
    expect(result.current.hasLiveLink).toBe(false)
    expect(result.current.version).toEqual({
      status: 'draft',
      sent_at: null,
      viewed_at: '2026-04-23T12:00:00.000Z',
      accepted_at: null,
      declined_at: null,
      public_token: null,
    })
  })

  it('supports hard reloads and clears prior status messages', async () => {
    loadCustomerSendPage
      .mockResolvedValueOnce(basePayload)
      .mockResolvedValueOnce({
        ...basePayload,
        public_url: 'https://example.test/quote/reloaded',
        version: {
          status: 'sent',
          sent_at: '2026-04-23T08:00:00.000Z',
          public_token: 'reloaded-token',
        },
      })
    saveCustomerSendDraft.mockResolvedValue({
      public_url: 'https://example.test/quote',
      version: { status: 'draft' },
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
    expect(result.current.message).toBe('Draft saved.')

    await act(async () => {
      await result.current.reload({ hard: true })
    })

    expect(result.current.message).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.publicUrl).toBe('https://example.test/quote/reloaded')
    expect(result.current.version).toEqual({
      status: 'sent',
      sent_at: '2026-04-23T08:00:00.000Z',
      viewed_at: null,
      accepted_at: null,
      declined_at: null,
      public_token: 'reloaded-token',
    })
  })

  it('fills missing mutation version fields from canonical defaults', () => {
    expect(
      normalizeCustomerSendVersion({ viewed_at: '2026-04-23T08:00:00.000Z' }, 'sent')
    ).toEqual({
      status: 'sent',
      sent_at: null,
      viewed_at: '2026-04-23T08:00:00.000Z',
      accepted_at: null,
      declined_at: null,
      public_token: null,
    })
  })
})

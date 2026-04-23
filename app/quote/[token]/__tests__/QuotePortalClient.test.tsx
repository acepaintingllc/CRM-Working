import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import QuotePortalClient from '../QuotePortalClient'
import type { EstimatePublicSnapshot } from '@/lib/customer-estimates/types'

const mockFetch = vi.fn()

function createResponse(payload: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 400,
    json: vi.fn(async () => payload),
  }
}

function createPublicSnapshot({
  status = 'sent',
  publicToken = 'public-token',
}: {
  status?: EstimatePublicSnapshot['status']
  publicToken?: string
} = {}): EstimatePublicSnapshot {
  return {
    estimate_id: 'estimate-1',
    estimate_version_id: 'version-1',
    version_number: 1,
    status,
    public_token: publicToken,
    public_url: `https://example.com/quote/${publicToken}`,
    draft: {},
    snapshot_json: {
      document: {
        meta: {
          title: 'Kitchen Quote',
          version_name: 'Option A',
          status,
          flow_version: 'v2',
          quote_date: '2026-04-15',
          sent_at: null,
          viewed_at: null,
          accepted_at: null,
          declined_at: null,
          estimate_id: 'estimate-1',
          version_state: 'sent',
          public_token: publicToken,
        },
      },
    },
    document: {
      meta: {
        title: 'Kitchen Quote',
        version_name: 'Option A',
        status,
        flow_version: 'v2',
        quote_date: '2026-04-15',
        sent_at: null,
        viewed_at: null,
        accepted_at: null,
        declined_at: null,
        estimate_id: 'estimate-1',
        version_state: 'sent',
        public_token: publicToken,
      },
      company: {
        business_name: 'ACE Painting',
        timezone: 'America/Chicago',
        main_phone: '111-111-1111',
        business_email: 'hello@ace.com',
        address: '123 Main Street',
        website: 'https://acepainting.example.com',
        sender_signature: 'ACE',
        logo_url: '',
      },
      customer: {
        name: 'Jordan Customer',
        email: 'jordan@example.com',
        phone: '444-444-4444',
        address: '456 Customer Ave',
        street: '456 Customer Ave',
        city: 'Leland',
        state: 'IN',
        zip: '46052',
      },
      intro_paragraph: '',
      closing_paragraph: '',
      quote_validity_days: 30,
      deposit_language: '',
      card_fee_note: '',
      quote_rows: [],
      scopes: [],
      total: 1200,
      terms: [],
    },
    sent_at: null,
    viewed_at: null,
    accepted_at: null,
    declined_at: null,
    locked_at: null,
  }
}

describe('QuotePortalClient', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it('submits typed signature accept payload', async () => {
    mockFetch.mockResolvedValue(createResponse({ data: { status: 'accepted' } }))

    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    const legalName = screen.getByLabelText('Full legal name')
    fireEvent.change(legalName, { target: { value: 'Jordan Customer' } })

    const typedSignature = screen.getByLabelText('Typed signature')
    fireEvent.change(typedSignature, { target: { value: 'Jordan Customer' } })

    const agreement = screen.getByRole('checkbox', { name: 'I agree to the scope, pricing, and terms shown above.' })
    fireEvent.click(agreement)

    fireEvent.click(screen.getByRole('button', { name: 'Accept Quote' }))

    await waitFor(() => {
      const [url, init] = mockFetch.mock.calls[0]
      const body = JSON.parse(String(init?.body))
      expect(url).toBe('/api/quote-public/public-token/accept')
      expect(init?.method).toBe('POST')
      expect(body).toMatchObject({
        legal_name: 'Jordan Customer',
        signature_type: 'typed',
        signature_value: 'Jordan Customer',
        accepted_terms: true,
      })
    })

    expect(await screen.findByText('Quote accepted and locked.')).toBeTruthy()
  })

  it('supports drawn signatures and submits canvas payload', async () => {
    mockFetch.mockResolvedValue(createResponse({ data: { status: 'accepted' } }))

    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Signature mode' }), { target: { value: 'drawn' } })

    const signatureCanvas = screen.getByTestId('quote-signature-canvas') as HTMLCanvasElement
    signatureCanvas.toDataURL = vi.fn(() => 'data:image/png;base64,QUJDRA==')
    const agree = screen.getByRole('checkbox', { name: 'I agree to the scope, pricing, and terms shown above.' })
    fireEvent.click(agree)

    const accept = screen.getByRole('button', { name: 'Accept Quote' })
    expect(accept).toBeDisabled()

    fireEvent.pointerDown(signatureCanvas, { pointerId: 1, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(signatureCanvas, { pointerId: 1, clientX: 12, clientY: 12 })
    fireEvent.pointerUp(signatureCanvas, { pointerId: 1, clientX: 12, clientY: 12 })

    expect(accept).toBeEnabled()
    fireEvent.click(accept)

    await waitFor(() => {
      const [url, init] = mockFetch.mock.calls[0]
      const body = JSON.parse(String(init?.body))
      expect(url).toBe('/api/quote-public/public-token/accept')
      expect(body.signature_type).toBe('drawn')
      expect(body.signature_value).toBe('data:image/png;base64,QUJDRA==')
    })
  })

  it('shows submit disabled state while accepting', async () => {
    let resolveFetch: (value: unknown) => void = () => {}
    const pending = new Promise((resolve) => {
      resolveFetch = resolve
    })
    mockFetch.mockReturnValue(pending as Promise<never>)

    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'I agree to the scope, pricing, and terms shown above.' }))
    const acceptButton = screen.getByRole('button', { name: 'Accept Quote' })
    const declineButton = screen.getByRole('button', { name: 'Decline' })
    fireEvent.click(acceptButton)

    expect(acceptButton).toBeDisabled()
    expect(declineButton).toBeDisabled()

    resolveFetch(createResponse({ data: { status: 'accepted' } }))

    await waitFor(() => {
      expect(screen.getByText('Quote accepted and locked.')).toBeTruthy()
    })
  })

  it('submits decline reasons and locks the portal on success', async () => {
    mockFetch.mockResolvedValue(
      createResponse({ data: createPublicSnapshot({ status: 'declined' }) })
    )

    render(<QuotePortalClient snapshot={createPublicSnapshot()} />)

    fireEvent.change(screen.getByLabelText('Decline note'), {
      target: { value: 'Going another direction' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))

    await waitFor(() => {
      const [url, init] = mockFetch.mock.calls[0]
      const body = JSON.parse(String(init?.body))
      expect(url).toBe('/api/quote-public/public-token/decline')
      expect(init?.method).toBe('POST')
      expect(body).toEqual({
        reason: 'Going another direction',
      })
    })

    expect(await screen.findByText('This quote has been declined and locked.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Accept Quote' })).toBeNull()
  })

  it('renders locked content for accepted quote', () => {
    render(<QuotePortalClient snapshot={createPublicSnapshot({ status: 'accepted' })} />)

    expect(screen.getByText('This quote has been accepted and locked.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Accept Quote' })).toBeNull()
  })

  it('renders locked content for declined quote', () => {
    render(<QuotePortalClient snapshot={createPublicSnapshot({ status: 'declined' })} />)

    expect(screen.getByText('This quote has been declined and locked.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Accept Quote' })).toBeNull()
  })
})

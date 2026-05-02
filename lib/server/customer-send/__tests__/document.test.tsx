import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildCustomerDocumentFromSendContext } from '../document'
import type { EstimateCustomerSendContextData } from '../contextTypes'
import { readFileSync } from 'fs'
import path from 'path'

const { mockBuildCustomerEstimateDocument, mockAssembleCustomerEstimateDocument } = vi.hoisted(() => ({
  mockBuildCustomerEstimateDocument: vi.fn(),
  mockAssembleCustomerEstimateDocument: vi.fn(),
}))

vi.mock('@/lib/customer-estimates/build', () => ({
  buildCustomerEstimateDocument: mockBuildCustomerEstimateDocument,
}))

vi.mock('@/lib/customer-estimates/assemble', () => ({
  assembleCustomerEstimateDocument: mockAssembleCustomerEstimateDocument,
}))

describe('customer send document builder', () => {
  beforeEach(() => {
    mockBuildCustomerEstimateDocument.mockReset()
    mockAssembleCustomerEstimateDocument.mockReset()
    mockBuildCustomerEstimateDocument.mockReturnValue({
      meta: {
        title: 'Kitchen Quote',
      },
      source_meta: {
        company: {},
        settings: {},
        overrides: {},
      },
    })
    mockAssembleCustomerEstimateDocument.mockReturnValue({
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
      company: {},
      customer: {},
      intro_paragraph: '',
      closing_paragraph: '',
      quote_validity_days: 90,
      deposit_language: '',
      card_fee_note: '',
      quote_rows: [],
      scopes: [],
      total: 1500,
      terms: [],
    })
  })

  it('passes context data through the builder and returns the assembled document contract', () => {
    const context: EstimateCustomerSendContextData = {
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
        customer_email: 'taylor@example.com',
        customer_phone: '555-1212',
        customer_address: '123 Main',
      },
      customer: {
        id: 'customer-1',
        name: 'Taylor',
        email: 'taylor@example.com',
        phone: '555-1212',
        address: '123 Main',
        street: '123 Main',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
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
        org_defaults: { updated_at: null },
      },
      catalogs: { paints: [] },
      settings: {
        default_template_key: 'default',
        quote_validity_days: 90,
        terms_text: 'Terms',
      },
      pricing_summary: { finalTotal: 1500 },
      latest_public_version: null,
      latest_sent_version: null,
      latest_draft_version: null,
      public_url: null,
      public_versions: [],
    }

    const result = buildCustomerDocumentFromSendContext({
      context,
      overrides: {
        title: 'Custom title',
        quote_validity_days: 45,
      },
      publicMeta: {
        status: 'sent',
        sent_at: '2026-04-22T12:00:00.000Z',
        public_token: 'token-1',
      },
    })

    expect(mockBuildCustomerEstimateDocument).toHaveBeenCalledWith({
      estimate: context.estimate,
      job: context.job,
      customer: context.customer,
      company: context.company,
      inputs: context.inputs,
      catalogs: context.catalogs,
      settings: context.settings,
      pricingSummary: { finalTotal: 1500 },
      overrides: {
        title: 'Custom title',
        quote_validity_days: 45,
      },
      publicMeta: {
        status: 'sent',
        sent_at: '2026-04-22T12:00:00.000Z',
        public_token: 'token-1',
      },
    })
    expect(mockAssembleCustomerEstimateDocument).toHaveBeenCalledWith({
      meta: {
        title: 'Kitchen Quote',
      },
      source_meta: {
        company: {},
        settings: {},
        overrides: {},
      },
    })
    expect(result).toEqual(expect.objectContaining({ total: 1500 }))
  })

  it('keeps server-side document assembly isolated from renderer modules', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'lib/server/customer-send/document.ts'),
      'utf8'
    )

    expect(source.includes("from '@/lib/customer-estimates/view'")).toBe(false)
    expect(source.includes("from '@/lib/customer-estimates/PublicEstimatePortal'")).toBe(false)
    expect(source.includes("from '@/lib/server/estimatePublicPortal'")).toBe(false)
  })
})

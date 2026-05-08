import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildCustomerDocumentFromSendContext } from '../document'
import type { EstimateCustomerSendContextData } from '../contextTypes'
import type { CustomerEstimateDocument } from '@/lib/customer-estimates/types'
import { readCustomerSendPdfDocument } from '../pdf'
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
        org_defaults: {
          default_template_key: 'default',
          quote_validity_days: 90,
          terms_text: 'Terms',
          walls_paint_id: null,
          walls_primer_id: null,
          ceiling_paint_id: null,
          ceiling_primer_id: null,
          trim_paint_id: null,
          trim_primer_id: null,
          labor_day_policy_enabled: true,
          dayhours: 8,
          rounding_increment_hours: 4,
          override_labor_rate: 55,
          job_minimum_enabled: false,
          job_minimum_amount: 0,
          standard_door_deduction_sf: 21,
          standard_window_deduction_sf: 15,
          baseboard_opening_deduction_lf: 3,
        },
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

  it('accepts a valid typed customer estimate document through the PDF boundary helper', () => {
    const document: CustomerEstimateDocument = {
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
        business_email: '',
        address: '',
        website: '',
        sender_signature: '',
        logo_url: '',
      },
      customer: {
        name: 'Taylor',
        email: 'taylor@example.com',
        phone: '',
        address: '123 Main St',
        street: '123 Main St',
        city: '',
        state: '',
        zip: '',
      },
      intro_paragraph: '',
      closing_paragraph: '',
      quote_validity_days: 45,
      deposit_language: '',
      card_fee_note: '',
      quote_rows: [
        {
          key: 'walls',
          label: 'Walls',
          description: 'Paint walls.',
          price: 1200,
        },
      ],
      scopes: [],
      total: 1200,
      terms: [],
      source_meta: {
        company: {
          business_name: true,
          main_phone: true,
          business_email: true,
          address: true,
          website: true,
          sender_signature: true,
          logo_url: true,
        },
        settings: {
          quote_validity_days: true,
          terms_text: true,
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
        contact_lines: ['Austin, TX'],
        logo_url: '',
        document_label: 'QUOTE',
        quote_date_label: '4/22/26',
      },
      customer_block: {
        lines: ['Taylor', '123 Main St'],
      },
      pricing_block: {
        rows: [
          {
            key: 'walls',
            label: 'Walls',
            description: 'Paint walls.',
            price: 1200,
          },
        ],
        total: 1200,
        footer_note: 'Thank you.',
      },
      terms_page: {
        title: 'Terms',
        sections: [
          {
            key: 'pricing',
            title: 'Pricing',
            paragraphs: ['Pricing is valid for 45 days.'],
          },
        ],
      },
      assembly_meta: {
        missing_company_fields: [],
        missing_payment_fields: [],
        missing_legal_fields: [],
        used_placeholder_fallbacks: false,
        used_explicit_terms_text: false,
      },
    }

    expect(readCustomerSendPdfDocument(document)).toBe(document)
  })

  it('rejects malformed PDF boundary input before it reaches PDF generation', () => {
    expect(
      readCustomerSendPdfDocument({
        meta: {
          title: 'Kitchen Quote',
        },
        pricing_block: {
          rows: [],
        },
      })
    ).toBeNull()
  })
})

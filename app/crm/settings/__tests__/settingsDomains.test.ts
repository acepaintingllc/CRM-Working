import { describe, expect, it } from 'vitest'
import {
  emptyCompanyProfileSettings,
  normalizeCompanyProfileSettings,
  parseCompanyProfileSettings,
} from '@/lib/settings/companyProfile'
import {
  emptyEstimateDefaults,
  normalizeEstimateDefaults,
  parseEstimateDefaults,
} from '@/lib/settings/estimateDefaults'
import {
  emptyQuoteSendDefaults,
  normalizeQuoteSendDefaults,
  parseQuoteSendDefaults,
} from '@/lib/settings/quoteSendDefaults'

describe('settings domain parsers', () => {
  it('normalizes company profile rows with stable defaults', () => {
    expect(normalizeCompanyProfileSettings(null)).toEqual(emptyCompanyProfileSettings)
    expect(
      normalizeCompanyProfileSettings({
        business_name: 'ACE',
        timezone: '',
        main_phone: 123,
      })
    ).toEqual({
      ...emptyCompanyProfileSettings,
      business_name: 'ACE',
      main_phone: '123',
    })
  })

  it('validates company profile email and URL fields', () => {
    expect(
      parseCompanyProfileSettings({
        ...emptyCompanyProfileSettings,
        business_name: 'ACE',
        business_email: 'not-an-email',
      })
    ).toEqual({
      ok: false,
      error: 'Business email must be a valid email address.',
    })

    expect(
      parseCompanyProfileSettings({
        ...emptyCompanyProfileSettings,
        business_name: 'ACE',
        website: 'ftp://example.com',
      })
    ).toEqual({
      ok: false,
      error: 'Website must be a valid http or https URL.',
    })
  })

  it('normalizes and validates quote send defaults', () => {
    expect(normalizeQuoteSendDefaults(null)).toEqual(emptyQuoteSendDefaults)

    expect(
      parseQuoteSendDefaults({
        default_template_key: 'bad',
        quote_validity_days: 90,
        terms_text: 'Terms',
      })
    ).toEqual({
      ok: false,
      error: 'Default template preset is invalid.',
    })

    expect(
      parseQuoteSendDefaults({
        default_template_key: emptyQuoteSendDefaults.default_template_key,
        quote_validity_days: 500,
        terms_text: 'Terms',
      })
    ).toEqual({
      ok: false,
      error: 'Quote validity days must be an integer between 1 and 365.',
    })
  })

  it('normalizes estimate defaults without leaking unrelated fields', () => {
    expect(normalizeEstimateDefaults(null)).toEqual(emptyEstimateDefaults)

    expect(
      parseEstimateDefaults({
        walls_paint_id: 'paint-1',
        override_labor_rate: -1,
      })
    ).toEqual({
      ok: false,
      error: 'Labor rate must be between 0 and 10000.',
    })

    expect(
      normalizeEstimateDefaults({
        walls_paint_id: 'paint-1',
        quote_validity_days: 30,
      })
    ).toEqual({
      ...emptyEstimateDefaults,
      walls_paint_id: 'paint-1',
    })
  })
})

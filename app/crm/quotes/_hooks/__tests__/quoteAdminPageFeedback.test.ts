import { describe, expect, it } from 'vitest'
import { buildQuoteAdminPageFeedback } from '../quoteAdminPageFeedback'

describe('buildQuoteAdminPageFeedback', () => {
  it('prefers load and action banners over validation messages', () => {
    expect(
      buildQuoteAdminPageFeedback({
        loading: false,
        loadError: 'Load failed.',
        validationError: 'Invalid field.',
      })
    ).toMatchObject({
      pageBanner: { tone: 'error', message: 'Load failed.' },
      inlineValidation: null,
    })

    expect(
      buildQuoteAdminPageFeedback({
        loading: false,
        actionError: 'Save failed.',
        validationError: 'Invalid field.',
      })
    ).toMatchObject({
      pageBanner: { tone: 'error', message: 'Save failed.' },
      inlineValidation: null,
    })
  })

  it('hides success banners while validation is active and restores inline validation', () => {
    expect(
      buildQuoteAdminPageFeedback({
        loading: false,
        notice: 'Saved.',
        validationError: 'Invalid field.',
      })
    ).toMatchObject({
      pageBanner: null,
      inlineValidation: 'Invalid field.',
      notice: 'Saved.',
    })
  })
})

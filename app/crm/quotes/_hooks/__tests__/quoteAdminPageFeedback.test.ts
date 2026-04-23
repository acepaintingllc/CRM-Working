import { describe, expect, it } from 'vitest'
import { buildQuoteAdminPageFeedback, buildQuoteAdminPageStatus } from '../quoteAdminPageFeedback'

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

  it('adds shared hasData and canRetry state for quote admin pages', () => {
    expect(
      buildQuoteAdminPageStatus({
        loading: false,
        hasData: true,
        canRetry: true,
        notice: 'Saved.',
      })
    ).toMatchObject({
      hasData: true,
      canRetry: true,
      pageBanner: { tone: 'success', message: 'Saved.' },
    })
  })

  it('supports warning notices for persisted writes that failed follow-up refresh', () => {
    expect(
      buildQuoteAdminPageStatus({
        loading: false,
        hasData: true,
        canRetry: true,
        notice: 'Saved, but refresh failed.',
        noticeTone: 'warning',
      })
    ).toMatchObject({
      noticeTone: 'warning',
      pageBanner: { tone: 'warning', message: 'Saved, but refresh failed.' },
    })
  })
})

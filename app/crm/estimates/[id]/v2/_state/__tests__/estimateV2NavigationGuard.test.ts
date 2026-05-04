import { describe, expect, it } from 'vitest'
import { shouldGuardEstimateV2Navigation } from '../estimateV2NavigationGuard'

const cleanSaveVm = {
  dirty: false,
  debugMeta: {
    dirtySource: null,
    lastSaveTrigger: null,
    lastNormalizedDomains: [],
    usingLocalPreview: false,
  },
}

describe('shouldGuardEstimateV2Navigation', () => {
  it('guards dirty edits before save completes', () => {
    expect(
      shouldGuardEstimateV2Navigation({
        saving: false,
        saveVm: {
          ...cleanSaveVm,
          dirty: true,
        },
      })
    ).toBe(true)
  })

  it('guards an in-flight save that was started from dirty edits', () => {
    expect(
      shouldGuardEstimateV2Navigation({
        saving: true,
        saveVm: {
          ...cleanSaveVm,
          debugMeta: {
            ...cleanSaveVm.debugMeta,
            lastSaveTrigger: 'auto',
          },
        },
      })
    ).toBe(true)
  })

  it('does not guard clean validation-only state', () => {
    expect(
      shouldGuardEstimateV2Navigation({
        saving: false,
        saveVm: cleanSaveVm,
      })
    ).toBe(false)
  })

  it('does not guard after the save has completed', () => {
    expect(
      shouldGuardEstimateV2Navigation({
        saving: false,
        saveVm: {
          ...cleanSaveVm,
          debugMeta: {
            ...cleanSaveVm.debugMeta,
            lastSaveTrigger: 'manual',
          },
        },
      })
    ).toBe(false)
  })
})

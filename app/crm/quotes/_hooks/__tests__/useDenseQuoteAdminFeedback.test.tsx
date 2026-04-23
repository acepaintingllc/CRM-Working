import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { useDenseQuoteAdminFeedback } from '../useDenseQuoteAdminFeedback'

describe('useDenseQuoteAdminFeedback', () => {
  it('clears stale notices when a new action begins', () => {
    const { result } = renderHook(() => useDenseQuoteAdminFeedback())

    act(() => {
      result.current.setSuccessNotice('Saved.')
    })

    expect(result.current.notice).toBe('Saved.')

    act(() => {
      result.current.beginAction()
    })

    expect(result.current.saving).toBe(true)
    expect(result.current.notice).toBeNull()
    expect(result.current.actionError).toBeNull()
  })

  it('replaces success notices with action errors', () => {
    const { result } = renderHook(() => useDenseQuoteAdminFeedback())

    act(() => {
      result.current.setSuccessNotice('Saved.')
      result.current.setErrorMessage('Save failed.')
    })

    expect(result.current.notice).toBeNull()
    expect(result.current.actionError).toBe('Save failed.')
  })

  it('tracks save-state transitions across begin and finish', () => {
    const { result } = renderHook(() => useDenseQuoteAdminFeedback())

    expect(result.current.saving).toBe(false)

    act(() => {
      result.current.beginAction()
    })

    expect(result.current.saving).toBe(true)

    act(() => {
      result.current.finishAction()
    })

    expect(result.current.saving).toBe(false)
  })
})

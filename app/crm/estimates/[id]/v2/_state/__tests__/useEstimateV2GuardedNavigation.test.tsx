import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { estimateRouteFamily } from '../../../estimateRouteFamily'
import type { EstimateV2EditorSaveVm } from '../estimateV2EditorTypes'
import { useEstimateV2GuardedNavigation } from '../useEstimateV2GuardedNavigation'

const push = vi.fn()
const save = vi.fn(async () => true)

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

function createSaveVm(
  patch: Partial<EstimateV2EditorSaveVm> = {}
): EstimateV2EditorSaveVm {
  return {
    dirty: true,
    canManualSave: true,
    canSaveAndContinue: true,
    saveStatus: 'idle',
    saveStatusText: 'Unsaved changes',
    saveStatusColor: '#f9e2b7',
    blockedReason: null,
    blockingIssues: [],
    calculationsStale: true,
    debugMeta: {
      dirtySource: 'walls',
      lastSaveTrigger: null,
      lastNormalizedDomains: [],
      usingLocalPreview: true,
    },
    save,
    saveDraft: vi.fn(),
    saveAndContinue: vi.fn(),
    ...patch,
  }
}

function renderGuardedNavigation({
  loading = false,
  saving = false,
  saveVm = createSaveVm(),
  listHref = '/crm/quotes',
}: {
  loading?: boolean
  saving?: boolean
  saveVm?: EstimateV2EditorSaveVm
  listHref?: string
} = {}) {
  return renderHook(() =>
    useEstimateV2GuardedNavigation({
      listHref,
      pageVm: { loading, saving },
      saveVm,
    })
  )
}

describe('useEstimateV2GuardedNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.replaceChildren()
    window.history.replaceState({ current: true }, '', '/crm/quotes/estimate-1')
  })

  it('opens a dirty confirmation for editor back navigation', () => {
    const { result } = renderGuardedNavigation()

    act(() => {
      result.current.navigationActions.requestBackNavigation()
    })

    expect(push).not.toHaveBeenCalled()
    expect(result.current.navigationVm.unsavedDialogProps.isOpen).toBe(true)
  })

  it('allows clean editor back navigation without confirmation', () => {
    const { result } = renderGuardedNavigation({
      saveVm: createSaveVm({
        dirty: false,
        canManualSave: false,
        calculationsStale: false,
        debugMeta: {
          dirtySource: null,
          lastSaveTrigger: null,
          lastNormalizedDomains: [],
          usingLocalPreview: false,
        },
      }),
    })

    act(() => {
      result.current.navigationActions.requestBackNavigation()
    })

    expect(push).toHaveBeenCalledWith('/crm/quotes')
    expect(result.current.navigationVm.unsavedDialogProps.isOpen).toBe(false)
  })

  it('guards same-origin shell link navigation while dirty', async () => {
    const clickHandlers: EventListener[] = []
    const originalAddEventListener = document.addEventListener.bind(document)
    const addEventListenerSpy = vi
      .spyOn(document, 'addEventListener')
      .mockImplementation((type, listener, options) => {
        if (type === 'click' && typeof listener === 'function') {
          clickHandlers.push(listener as EventListener)
        }
        return originalAddEventListener(type, listener, options)
      })
    const { result } = renderGuardedNavigation()
    await act(async () => undefined)
    const link = document.createElement('a')
    link.href = '/crm/customers'
    link.textContent = 'Customers'
    document.body.appendChild(link)

    act(() => {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
      Object.defineProperty(event, 'target', { value: link })
      clickHandlers.forEach((handler) => handler(event))
    })
    addEventListenerSpy.mockRestore()

    expect(push).not.toHaveBeenCalled()
    expect(result.current.navigationVm.unsavedDialogProps.isOpen).toBe(true)

    act(() => {
      result.current.navigationVm.unsavedDialogProps.onLeave()
    })

    expect(push).toHaveBeenCalledWith('/crm/customers')
    expect(result.current.navigationVm.unsavedDialogProps.isOpen).toBe(false)
  })

  it('saves before leaving through a guarded shell navigation', async () => {
    const clickHandlers: EventListener[] = []
    const originalAddEventListener = document.addEventListener.bind(document)
    const addEventListenerSpy = vi
      .spyOn(document, 'addEventListener')
      .mockImplementation((type, listener, options) => {
        if (type === 'click' && typeof listener === 'function') {
          clickHandlers.push(listener as EventListener)
        }
        return originalAddEventListener(type, listener, options)
      })
    const { result } = renderGuardedNavigation()
    await act(async () => undefined)
    const link = document.createElement('a')
    link.href = '/crm/jobs'
    link.textContent = 'Jobs'
    document.body.appendChild(link)

    act(() => {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
      Object.defineProperty(event, 'target', { value: link })
      clickHandlers.forEach((handler) => handler(event))
    })
    addEventListenerSpy.mockRestore()
    act(() => {
      result.current.navigationVm.unsavedDialogProps.onSave()
    })

    await waitFor(() => {
      expect(save).toHaveBeenCalledWith()
      expect(push).toHaveBeenCalledWith('/crm/jobs')
    })
  })

  it('uses send-specific warning copy when a dirty navigation targets the send route', async () => {
    const clickHandlers: EventListener[] = []
    const originalAddEventListener = document.addEventListener.bind(document)
    const addEventListenerSpy = vi
      .spyOn(document, 'addEventListener')
      .mockImplementation((type, listener, options) => {
        if (type === 'click' && typeof listener === 'function') {
          clickHandlers.push(listener as EventListener)
        }
        return originalAddEventListener(type, listener, options)
      })
    const { result } = renderGuardedNavigation()
    await act(async () => undefined)
    const link = document.createElement('a')
    link.href = estimateRouteFamily.sendHref('estimate-1')
    link.textContent = 'Send'
    document.body.appendChild(link)

    act(() => {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
      Object.defineProperty(event, 'target', { value: link })
      clickHandlers.forEach((handler) => handler(event))
    })
    addEventListenerSpy.mockRestore()

    expect(result.current.navigationVm.unsavedDialogProps.isOpen).toBe(true)
    expect(result.current.navigationVm.unsavedDialogProps.noticeText).toBe(
      'The send page uses the last saved server total. Your unsaved editor changes will not be included unless you save first.'
    )
  })

  it('cancels a guarded dirty navigation without routing', () => {
    const { result } = renderGuardedNavigation()

    act(() => {
      result.current.navigationActions.requestBackNavigation()
    })
    act(() => {
      result.current.navigationVm.unsavedDialogProps.onStay()
    })

    expect(push).not.toHaveBeenCalled()
    expect(result.current.navigationVm.unsavedDialogProps.isOpen).toBe(false)
  })

  it('guards browser back navigation and restores the editor URL while dirty', async () => {
    const popStateHandlers: EventListener[] = []
    const originalAddEventListener = window.addEventListener.bind(window)
    const addEventListenerSpy = vi
      .spyOn(window, 'addEventListener')
      .mockImplementation((type, listener, options) => {
        if (type === 'popstate' && typeof listener === 'function') {
          popStateHandlers.push(listener as EventListener)
        }
        return originalAddEventListener(type, listener, options)
      })
    const { result } = renderGuardedNavigation()
    await act(async () => undefined)

    window.history.replaceState({ next: true }, '', '/crm/quotes')
    act(() => {
      popStateHandlers.forEach((handler) => handler(new PopStateEvent('popstate')))
    })
    addEventListenerSpy.mockRestore()

    expect(push).not.toHaveBeenCalled()
    expect(window.location.pathname).toBe('/crm/quotes/estimate-1')
    expect(result.current.navigationVm.unsavedDialogProps.isOpen).toBe(true)
  })

  it('guards navigation while a dirty save is still in flight', () => {
    const { result } = renderGuardedNavigation({
      saving: true,
      saveVm: createSaveVm({
        dirty: false,
        canManualSave: false,
        saveStatus: 'autosaving',
        debugMeta: {
          dirtySource: 'walls',
          lastSaveTrigger: 'auto',
          lastNormalizedDomains: [],
          usingLocalPreview: true,
        },
      }),
    })

    act(() => {
      result.current.navigationActions.requestBackNavigation()
    })

    expect(push).not.toHaveBeenCalled()
    expect(result.current.navigationVm.unsavedDialogProps.isOpen).toBe(true)
  })
})

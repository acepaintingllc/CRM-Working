import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useDenseQuoteAdminOrchestrator } from '../useDenseQuoteAdminOrchestrator'

type DiscardStatus = 'idle' | 'confirming' | 'applying'
type MaybePromise<T> = T | Promise<T>

type TestIntent = {
  type: 'select' | 'reload'
  id?: string
}

type TestResourceData = {
  value: number
  shouldSync: boolean
}

type TestState = {
  count: number
  dirty: boolean
  pendingIntent: TestIntent | null
  discardStatus: DiscardStatus
  syncedValue: number | null
  actionLog: string[]
}

type TestAction =
  | { type: 'increment'; amount: number }
  | { type: 'setDirty'; dirty: boolean }
  | { type: 'syncResource'; value: number }
  | { type: 'discard.queue'; intent: TestIntent }
  | { type: 'discard.setStatus'; status: DiscardStatus }
  | { type: 'discard.clear' }

const cleanState: TestState = {
  count: 0,
  dirty: false,
  pendingIntent: null,
  discardStatus: 'idle',
  syncedValue: null,
  actionLog: [],
}

function actionLabel(action: TestAction) {
  if (action.type === 'discard.setStatus') return `${action.type}:${action.status}`
  return action.type
}

function testReducer(state: TestState, action: TestAction): TestState {
  const nextState = {
    ...state,
    actionLog: [...state.actionLog, actionLabel(action)],
  }

  switch (action.type) {
    case 'increment':
      return { ...nextState, count: state.count + action.amount }
    case 'setDirty':
      return { ...nextState, dirty: action.dirty }
    case 'syncResource':
      return { ...nextState, count: action.value, syncedValue: action.value }
    case 'discard.queue':
      return {
        ...nextState,
        pendingIntent: action.intent,
        discardStatus: 'confirming',
      }
    case 'discard.setStatus':
      return { ...nextState, discardStatus: action.status }
    case 'discard.clear':
      return {
        ...nextState,
        pendingIntent: null,
        discardStatus: 'idle',
      }
  }
}

const discard = {
  getPendingIntent: (state: TestState) => state.pendingIntent,
  queue: (intent: TestIntent): TestAction => ({ type: 'discard.queue', intent }),
  setStatus: (status: DiscardStatus): TestAction => ({ type: 'discard.setStatus', status }),
  clear: (): TestAction => ({ type: 'discard.clear' }),
}

type HookProps = {
  initialState?: TestState
  resourceData?: TestResourceData
  getResourceSyncAction?: (state: TestState, resourceData: TestResourceData) => TestAction | null
}

function renderOrchestrator({
  initialState = cleanState,
  resourceData,
  getResourceSyncAction,
}: HookProps = {}) {
  return renderHook(
    (props: HookProps) =>
      useDenseQuoteAdminOrchestrator<TestState, TestAction, TestIntent, TestResourceData>({
        reducer: testReducer,
        initialState: props.initialState ?? cleanState,
        resourceData: props.resourceData,
        getResourceSyncAction: props.getResourceSyncAction,
        hasUnsavedChanges: (state) => state.dirty,
        discard,
      }),
    {
      initialProps: {
        initialState,
        resourceData,
        getResourceSyncAction,
      },
    }
  )
}

function stateWith(overrides: Partial<TestState>): TestState {
  return {
    ...cleanState,
    ...overrides,
    actionLog: overrides.actionLog ?? [],
  }
}

describe('useDenseQuoteAdminOrchestrator', () => {
  it('dispatches actions through the reducer and synchronously updates stateRef', () => {
    const { result } = renderOrchestrator()
    let stateRefCountBeforeReactFlush: number | null = null

    act(() => {
      result.current.applyAction({ type: 'increment', amount: 3 })
      stateRefCountBeforeReactFlush = result.current.stateRef.current.count
    })

    expect(stateRefCountBeforeReactFlush).toBe(3)
    expect(result.current.state.count).toBe(3)
    expect(result.current.state.actionLog).toEqual(['increment'])
  })

  it('applies a resource sync action when resourceData changes', async () => {
    const getResourceSyncAction = vi.fn((state: TestState, resourceData: TestResourceData) => {
      if (!resourceData.shouldSync) return null
      return { type: 'syncResource', value: state.count + resourceData.value } satisfies TestAction
    })
    const { result, rerender } = renderOrchestrator({
      resourceData: { value: 2, shouldSync: false },
      getResourceSyncAction,
    })

    expect(result.current.state.actionLog).toEqual([])

    rerender({
      initialState: cleanState,
      resourceData: { value: 5, shouldSync: true },
      getResourceSyncAction,
    })

    await waitFor(() => {
      expect(result.current.state.syncedValue).toBe(5)
    })
    expect(result.current.state.actionLog).toEqual(['syncResource'])
  })

  it('does not dispatch when getResourceSyncAction returns null', () => {
    const getResourceSyncAction = vi.fn(() => null)
    const { result, rerender } = renderOrchestrator({
      resourceData: { value: 1, shouldSync: false },
      getResourceSyncAction,
    })

    rerender({
      initialState: cleanState,
      resourceData: { value: 2, shouldSync: false },
      getResourceSyncAction,
    })

    expect(getResourceSyncAction).toHaveBeenCalled()
    expect(result.current.state.actionLog).toEqual([])
  })

  it('does not run the resource sync effect when resourceData is undefined', () => {
    const getResourceSyncAction = vi.fn(() => ({ type: 'syncResource', value: 1 }) satisfies TestAction)

    renderOrchestrator({ getResourceSyncAction })

    expect(getResourceSyncAction).not.toHaveBeenCalled()
  })

  it('runs a changed transition immediately when there are no unsaved changes', () => {
    const run = vi.fn(() => 'ran')
    const { result } = renderOrchestrator()
    let returned: MaybePromise<string> | false = false

    act(() => {
      returned = result.current.requestTransition(
        { type: 'select', id: 'row-2' },
        { changed: true, run }
      )
    })

    expect(returned).toBe('ran')
    expect(run).toHaveBeenCalledTimes(1)
    expect(result.current.state.actionLog).toEqual([])
  })

  it('runs unchanged transitions immediately regardless of dirty state', () => {
    const run = vi.fn(() => 'unchanged')
    const { result } = renderOrchestrator({
      initialState: stateWith({ dirty: true }),
    })
    let returned: MaybePromise<string> | false = false

    act(() => {
      returned = result.current.requestTransition(
        { type: 'select', id: 'row-2' },
        { changed: false, run }
      )
    })

    expect(returned).toBe('unchanged')
    expect(run).toHaveBeenCalledTimes(1)
    expect(result.current.state.pendingIntent).toBeNull()
    expect(result.current.state.actionLog).toEqual([])
  })

  it('queues changed transitions when unsaved changes are present', () => {
    const intent: TestIntent = { type: 'select', id: 'row-2' }
    const run = vi.fn(() => 'ran')
    const { result } = renderOrchestrator({
      initialState: stateWith({ dirty: true }),
    })
    let returned: MaybePromise<string> | false = 'ran'

    act(() => {
      returned = result.current.requestTransition(intent, { changed: true, run })
    })

    expect(returned).toBe(false)
    expect(run).not.toHaveBeenCalled()
    expect(result.current.state.pendingIntent).toEqual(intent)
    expect(result.current.state.discardStatus).toBe('confirming')
    expect(result.current.state.actionLog).toEqual(['discard.queue'])
  })

  it('blocks changed transitions while a pending intent already exists', () => {
    const run = vi.fn(() => 'ran')
    const { result } = renderOrchestrator({
      initialState: stateWith({
        dirty: true,
        pendingIntent: { type: 'select', id: 'row-1' },
        discardStatus: 'confirming',
      }),
    })
    let returned: MaybePromise<string> | false = 'ran'

    act(() => {
      returned = result.current.requestTransition(
        { type: 'reload' },
        { changed: true, run }
      )
    })

    expect(returned).toBe(false)
    expect(run).not.toHaveBeenCalled()
    expect(result.current.state.pendingIntent).toEqual({ type: 'select', id: 'row-1' })
    expect(result.current.state.actionLog).toEqual([])
  })

  it('clears pending discard state on cancelDiscard', () => {
    const { result } = renderOrchestrator({
      initialState: stateWith({
        pendingIntent: { type: 'select', id: 'row-1' },
        discardStatus: 'confirming',
      }),
    })

    act(() => {
      result.current.cancelDiscard()
    })

    expect(result.current.state.pendingIntent).toBeNull()
    expect(result.current.state.discardStatus).toBe('idle')
    expect(result.current.state.actionLog).toEqual(['discard.clear'])
  })

  it('returns false and dispatches nothing when confirmDiscard has no pending intent', () => {
    const applyIntent = vi.fn(() => true)
    const { result } = renderOrchestrator()
    let returned: MaybePromise<boolean> | false = true

    act(() => {
      returned = result.current.confirmDiscard(applyIntent)
    })

    expect(returned).toBe(false)
    expect(applyIntent).not.toHaveBeenCalled()
    expect(result.current.state.actionLog).toEqual([])
  })

  it('applies and clears a pending synchronous discard intent', () => {
    const pendingIntent: TestIntent = { type: 'select', id: 'row-2' }
    const applyIntent = vi.fn(() => 'applied')
    const { result } = renderOrchestrator({
      initialState: stateWith({
        pendingIntent,
        discardStatus: 'confirming',
      }),
    })
    let returned: MaybePromise<string> | false = false

    act(() => {
      returned = result.current.confirmDiscard(applyIntent)
    })

    expect(returned).toBe('applied')
    expect(applyIntent).toHaveBeenCalledWith(pendingIntent)
    expect(result.current.state.pendingIntent).toBeNull()
    expect(result.current.state.actionLog).toEqual([
      'discard.setStatus:applying',
      'discard.clear',
    ])
  })

  it('clears a pending async discard intent only after the promise settles', async () => {
    const pendingIntent: TestIntent = { type: 'reload' }
    let resolveIntent: ((value: 'applied') => void) | null = null
    const applyIntent = vi.fn(
      () =>
        new Promise<'applied'>((resolve) => {
          resolveIntent = resolve
        })
    )
    const { result } = renderOrchestrator({
      initialState: stateWith({
        pendingIntent,
        discardStatus: 'confirming',
      }),
    })
    let confirmResult: MaybePromise<'applied'> | false = false

    act(() => {
      confirmResult = result.current.confirmDiscard(applyIntent)
    })

    expect(applyIntent).toHaveBeenCalledWith(pendingIntent)
    expect(result.current.state.discardStatus).toBe('applying')
    expect(result.current.state.pendingIntent).toEqual(pendingIntent)
    expect(result.current.state.actionLog).toEqual(['discard.setStatus:applying'])

    if (confirmResult === false || confirmResult === 'applied') {
      throw new Error('Expected async confirmDiscard to return a pending promise.')
    }

    await act(async () => {
      resolveIntent?.('applied')
      await confirmResult
    })

    expect(await confirmResult).toBe('applied')
    expect(result.current.state.pendingIntent).toBeNull()
    expect(result.current.state.actionLog).toEqual([
      'discard.setStatus:applying',
      'discard.clear',
    ])
  })

  it('clears pending discard state and rethrows when applyIntent throws', () => {
    const error = new Error('apply failed')
    const applyIntent = vi.fn(() => {
      throw error
    })
    const { result } = renderOrchestrator({
      initialState: stateWith({
        pendingIntent: { type: 'reload' },
        discardStatus: 'confirming',
      }),
    })
    let thrownError: unknown = null

    act(() => {
      try {
        result.current.confirmDiscard(applyIntent)
      } catch (caughtError) {
        thrownError = caughtError
      }
    })

    expect(thrownError).toBe(error)
    expect(result.current.state.pendingIntent).toBeNull()
    expect(result.current.state.actionLog).toEqual([
      'discard.setStatus:applying',
      'discard.clear',
    ])
  })
})

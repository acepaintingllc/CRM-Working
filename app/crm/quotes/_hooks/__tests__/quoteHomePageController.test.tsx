import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useQuoteHomePageController } from '../quoteHomePageController'

const versionItem = {
  estimate_id: 'estimate-1',
  job_id: 'job-1',
  customer_id: 'customer-1',
  version_name: 'Version A',
  version_state: 'draft',
  version_kind: 'standard',
  version_sort_order: 1,
  job_title: 'Kitchen',
  customer_name: 'Alice',
  final_total: 500,
  updated_at: '2026-04-20T10:00:00.000Z',
  created_at: '2026-04-19T10:00:00.000Z',
  is_sent_estimate: false,
} as const

function buildController() {
  const homeAttemptRefresh = vi.fn<
    (options?: {
      preserveDataOnError?: boolean
      reportError?: boolean
    }) => Promise<{ ok: boolean; error: string | null; data: null }>
  >(async () => ({ ok: true, error: null, data: null }))
  const versionsAttemptRefresh = vi.fn<
    (options?: {
      preserveDataOnError?: boolean
      reportError?: boolean
    }) => Promise<{ ok: boolean; error: string | null }>
  >(async () => ({ ok: true, error: null }))
  const homeResource = {
    refresh: vi.fn(async () => true),
    attemptRefresh: homeAttemptRefresh,
  }
  const versions = {
    items: [versionItem],
    refresh: vi.fn(async () => true),
    attemptRefresh: versionsAttemptRefresh,
  }
  const deleteController = {
    requestDeleteVersion: vi.fn(),
    cancelDelete: vi.fn(),
    confirmDeleteVersion: vi.fn(async () => true),
  }

  const hook = renderHook(() =>
    useQuoteHomePageController({
      homeResource,
      versions,
      deleteController,
    })
  )

  return {
    ...hook,
    homeResource,
    versions,
    deleteController,
  }
}

describe('useQuoteHomePageController', () => {
  it('requests delete for the matching version item', () => {
    const { result, deleteController } = buildController()

    act(() => {
      result.current.actions.requestDelete('estimate-1')
    })

    expect(deleteController.requestDeleteVersion).toHaveBeenCalledWith(versionItem)
    expect(result.current.actionWarning).toBeNull()
  })

  it('does not refresh when delete confirmation fails', async () => {
    const { result, deleteController, homeResource, versions } = buildController()
    deleteController.confirmDeleteVersion.mockResolvedValue(false)

    await act(async () => {
      expect(await result.current.actions.confirmDelete()).toBe(false)
    })

    expect(homeResource.attemptRefresh).not.toHaveBeenCalled()
    expect(versions.attemptRefresh).not.toHaveBeenCalled()
    expect(result.current.actionWarning).toBeNull()
  })

  it('keeps delete success explicit when follow-up refresh fails', async () => {
    const { result, homeResource, versions } = buildController()
    homeResource.attemptRefresh.mockResolvedValue({
      ok: false,
      error: 'bootstrap refresh failed',
      data: null,
    })
    versions.attemptRefresh.mockResolvedValue({
      ok: false,
      error: 'versions refresh failed',
    })

    await act(async () => {
      expect(await result.current.actions.confirmDelete()).toBe(true)
    })

    expect(homeResource.attemptRefresh).toHaveBeenCalledWith({
      preserveDataOnError: true,
      reportError: false,
    })
    expect(versions.attemptRefresh).toHaveBeenCalledWith({
      preserveDataOnError: true,
      reportError: false,
    })
    expect(result.current.actionWarning).toEqual({
      source: 'delete',
      message:
        'Quote deleted, but follow-up refresh failed. Reload the page if the quote still appears. Home refresh failed. bootstrap refresh failed Versions refresh failed. versions refresh failed',
    })
  })

  it('clears prior warnings when running a manual refresh', async () => {
    const { result, homeResource, versions } = buildController()
    homeResource.attemptRefresh.mockResolvedValue({
      ok: false,
      error: 'bootstrap refresh failed',
      data: null,
    })

    await act(async () => {
      await result.current.actions.confirmDelete()
    })

    expect(result.current.actionWarning).toBeTruthy()

    await act(async () => {
      expect(await result.current.actions.refresh()).toBe(true)
    })

    expect(homeResource.refresh).toHaveBeenCalledTimes(1)
    expect(versions.refresh).toHaveBeenCalledTimes(1)
    expect(result.current.actionWarning).toBeNull()
  })
})

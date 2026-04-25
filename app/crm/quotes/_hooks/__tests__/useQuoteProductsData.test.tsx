import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { QuoteProductQuery, QuoteProductRow } from '@/lib/quotes/productsForm'
import { useQuoteProductsData } from '../useQuoteProductsData'

const { loadQuoteProducts } = vi.hoisted(() => ({
  loadQuoteProducts: vi.fn(),
}))

vi.mock('@/lib/quotes/client', () => ({
  loadQuoteProducts,
}))

function buildProduct(overrides: Partial<QuoteProductRow> = {}): QuoteProductRow {
  return {
    id: 'product-1',
    name: 'Super Paint',
    family: 'Paint',
    base: 'A',
    subtype: 'Interior',
    cost_per_unit: 30,
    coverage_sqft_per_gal_per_coat: 350,
    efficiency_pct: 90,
    default_coats: 2,
    default_sheen: 'Eggshell',
    default_scopes: ['Walls'],
    notes: '',
    status: 'Active',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, resolve, reject }
}

const initialQuery: QuoteProductQuery = {
  family: 'Paint',
  status: 'all',
  search: null,
}

describe('useQuoteProductsData', () => {
  beforeEach(() => {
    loadQuoteProducts.mockReset()
  })

  it('keeps a known-row cache across query slices', async () => {
    const paint = buildProduct({ id: 'paint-1', name: 'Super Paint' })
    const primer = buildProduct({ id: 'primer-1', name: 'Prime Coat', family: 'Primer' })

    loadQuoteProducts
      .mockResolvedValueOnce([paint])
      .mockResolvedValueOnce([primer])

    const { result, rerender } = renderHook(
      ({ query }: { query: QuoteProductQuery }) => useQuoteProductsData({ query }),
      { initialProps: { query: initialQuery } }
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data.map((product) => product.id)).toEqual(['paint-1'])
    expect(result.current.allKnownData.map((product) => product.id)).toEqual(['paint-1'])

    rerender({
      query: {
        ...initialQuery,
        family: 'Primer',
      },
    })

    await waitFor(() => {
      expect(result.current.data.map((product) => product.id)).toEqual(['primer-1'])
    })

    expect(result.current.allKnownData.map((product) => product.id)).toEqual([
      'paint-1',
      'primer-1',
    ])
  })

  it('lets the latest request win and ignores stale results', async () => {
    const firstRefresh = createDeferred<QuoteProductRow[]>()
    const secondRefresh = createDeferred<QuoteProductRow[]>()

    loadQuoteProducts
      .mockResolvedValueOnce([buildProduct({ id: 'paint-1' })])
      .mockReturnValueOnce(firstRefresh.promise)
      .mockReturnValueOnce(secondRefresh.promise)

    const { result } = renderHook(() => useQuoteProductsData({ query: initialQuery }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    let staleResult: Awaited<ReturnType<typeof result.current.attemptRefresh>> | null = null
    let latestResult: Awaited<ReturnType<typeof result.current.attemptRefresh>> | null = null

    await act(async () => {
      const stalePromise = result.current.attemptRefresh()
      const latestPromise = result.current.attemptRefresh()

      secondRefresh.resolve([buildProduct({ id: 'paint-2', name: 'Latest Paint' })])
      latestResult = await latestPromise

      firstRefresh.resolve([buildProduct({ id: 'paint-stale', name: 'Stale Paint' })])
      staleResult = await stalePromise
    })

    expect(latestResult).toEqual({
      ok: true,
      error: null,
      data: [expect.objectContaining({ id: 'paint-2' })],
    })
    expect(staleResult).toEqual({
      ok: false,
      error: null,
      data: null,
    })
    expect(result.current.data.map((product) => product.id)).toEqual(['paint-2'])
    expect(result.current.allKnownData.map((product) => product.id)).toEqual([
      'paint-1',
      'paint-2',
    ])
  })

  it('honors preserveDataOnError and reportError for the visible and known rows', async () => {
    const paint = buildProduct({ id: 'paint-1' })

    loadQuoteProducts
      .mockResolvedValueOnce([paint])
      .mockRejectedValueOnce(new Error('Silent refresh failed.'))
      .mockRejectedValueOnce(new Error('Visible refresh failed.'))

    const { result } = renderHook(() => useQuoteProductsData({ query: initialQuery }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      const refreshResult = await result.current.attemptRefresh({
        preserveDataOnError: true,
        reportError: false,
      })

      expect(refreshResult).toEqual({
        ok: false,
        error: 'Silent refresh failed.',
        data: null,
      })
    })

    expect(result.current.error).toBeNull()
    expect(result.current.data).toEqual([paint])
    expect(result.current.allKnownData).toEqual([paint])

    await act(async () => {
      const refreshResult = await result.current.attemptRefresh()

      expect(refreshResult).toEqual({
        ok: false,
        error: 'Visible refresh failed.',
        data: null,
      })
    })

    expect(result.current.error).toBe('Visible refresh failed.')
    expect(result.current.data).toEqual([])
    expect(result.current.allKnownData).toEqual([])
  })
})

'use client'

import type { Dispatch, SetStateAction } from 'react'
import {
  createQuoteProduct,
  deleteQuoteProduct,
  updateQuoteProduct,
} from '@/lib/quotes/client'
import type { QuoteProductRow } from '@/lib/quotes/productsForm'

type ResourceSetter = Dispatch<SetStateAction<QuoteProductRow[]>>

type Options = {
  setData: ResourceSetter
  setSaving: (value: boolean) => void
  setActionError: (value: string | null) => void
}

export function useQuoteProductMutations({ setData, setSaving, setActionError }: Options) {
  async function createProduct(payload: Parameters<typeof createQuoteProduct<QuoteProductRow>>[0]) {
    setSaving(true)
    setActionError(null)
    try {
      const created = await createQuoteProduct<QuoteProductRow>(payload)
      setData((current) => [created.data, ...current])
      return {
        data: created.data,
        notice: created.notice ?? 'Product created.',
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to create product.')
      return null
    } finally {
      setSaving(false)
    }
  }

  async function updateProduct(
    id: string,
    payload: Parameters<typeof updateQuoteProduct<QuoteProductRow>>[1]
  ) {
    setSaving(true)
    setActionError(null)
    try {
      const updated = await updateQuoteProduct<QuoteProductRow>(id, payload)
      setData((current) => current.map((product) => (product.id === id ? updated.data : product)))
      return {
        data: updated.data,
        notice: updated.notice ?? 'Product saved.',
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to save product.')
      return null
    } finally {
      setSaving(false)
    }
  }

  async function removeProduct(selected: QuoteProductRow) {
    setSaving(true)
    setActionError(null)
    try {
      await deleteQuoteProduct(selected.id)
      setData((current) => current.filter((product) => product.id !== selected.id))
      return {
        ok: true as const,
        notice: 'Product deleted.',
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to delete product.')
      return null
    } finally {
      setSaving(false)
    }
  }

  return {
    createProduct,
    updateProduct,
    removeProduct,
  }
}

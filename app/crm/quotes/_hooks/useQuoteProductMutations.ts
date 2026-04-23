'use client'

import type { Dispatch, SetStateAction } from 'react'
import {
  createQuoteProduct,
  deleteQuoteProduct,
  updateQuoteProduct,
} from '@/lib/quotes/client'
import type { QuoteProductRow } from '@/lib/quotes/productsForm'
import type { useDenseQuoteAdminFeedback } from './useDenseQuoteAdminFeedback'

type Options = {
  setData: Dispatch<SetStateAction<QuoteProductRow[]>>
  feedback: ReturnType<typeof useDenseQuoteAdminFeedback>
}

export function useQuoteProductMutations({ setData, feedback }: Options) {
  async function createProduct(payload: Parameters<typeof createQuoteProduct<QuoteProductRow>>[0]) {
    feedback.beginAction()
    try {
      const created = await createQuoteProduct<QuoteProductRow>(payload)
      setData((current) => [created.data, ...current])
      return {
        data: created.data,
        notice: created.notice ?? 'Product created.',
      }
    } catch (error) {
      feedback.setErrorMessage(error instanceof Error ? error.message : 'Failed to create product.')
      return null
    } finally {
      feedback.finishAction()
    }
  }

  async function updateProduct(
    id: string,
    payload: Parameters<typeof updateQuoteProduct<QuoteProductRow>>[1]
  ) {
    feedback.beginAction()
    try {
      const updated = await updateQuoteProduct<QuoteProductRow>(id, payload)
      setData((current) => current.map((product) => (product.id === id ? updated.data : product)))
      return {
        data: updated.data,
        notice: updated.notice ?? 'Product saved.',
      }
    } catch (error) {
      feedback.setErrorMessage(error instanceof Error ? error.message : 'Failed to save product.')
      return null
    } finally {
      feedback.finishAction()
    }
  }

  async function removeProduct(selected: QuoteProductRow) {
    feedback.beginAction()
    try {
      await deleteQuoteProduct(selected.id)
      setData((current) => current.filter((product) => product.id !== selected.id))
      return {
        ok: true as const,
        notice: 'Product deleted.',
      }
    } catch (error) {
      feedback.setErrorMessage(error instanceof Error ? error.message : 'Failed to delete product.')
      return null
    } finally {
      feedback.finishAction()
    }
  }

  return {
    createProduct,
    updateProduct,
    removeProduct,
  }
}

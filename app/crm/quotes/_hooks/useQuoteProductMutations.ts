'use client'

import type { Dispatch, SetStateAction } from 'react'
import {
  createQuoteProduct,
  deleteQuoteProduct,
  updateQuoteProduct,
} from '@/lib/quotes/client'
import {
  quoteProductMatchesQuery,
  type QuoteProductQuery,
  type QuoteProductRow,
} from '@/lib/quotes/productsForm'
import type { useDenseQuoteAdminFeedback } from './useDenseQuoteAdminFeedback'

type Options = {
  setData: Dispatch<SetStateAction<QuoteProductRow[]>>
  getQuery: () => QuoteProductQuery
  feedback: ReturnType<typeof useDenseQuoteAdminFeedback>
}

export function useQuoteProductMutations({ setData, getQuery, feedback }: Options) {
  async function createProduct(payload: Parameters<typeof createQuoteProduct<QuoteProductRow>>[0]) {
    feedback.beginAction()
    try {
      const created = await createQuoteProduct<QuoteProductRow>(payload)
      const query = getQuery()
      setData((current) =>
        quoteProductMatchesQuery(created.data, query) ? [created.data, ...current] : current
      )
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
      const query = getQuery()
      setData((current) => {
        const matchesQuery = quoteProductMatchesQuery(updated.data, query)
        if (matchesQuery) {
          const hasExisting = current.some((product) => product.id === id)
          if (hasExisting) {
            return current.map((product) => (product.id === id ? updated.data : product))
          }
          return [updated.data, ...current]
        }

        return current.filter((product) => product.id !== id)
      })
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

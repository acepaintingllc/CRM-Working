'use client'

import {
  createQuoteProduct,
  deleteQuoteProduct,
  updateQuoteProduct,
} from '@/lib/quotes/client'
import {
  normalizeQuoteProductFamily,
  quoteProductMatchesQuery,
  validateQuoteProductDraft,
  type QuoteProductRow,
} from '@/lib/quotes/productsForm'
import { removeProductFromVisibleSlice, upsertProductIntoVisibleSlice } from './quoteProductsControllerUtils'
import { buildCurrentQuery } from './quoteProductsPageTransitions'
import type { QuoteProductsControllerAction, QuoteProductsControllerState } from './quoteProductsPageState'
import type { QuoteProductsResourceAdapter } from './useQuoteProductsData'

type MutationSuccess =
  | { ok: true; action: QuoteProductsControllerAction }
  | { ok: false; error: string }

type SuccessfulDraftValidation = Extract<
  ReturnType<typeof validateQuoteProductDraft>,
  { ok: true }
>

export function validateDraftForSave(state: QuoteProductsControllerState) {
  return validateQuoteProductDraft(state.editor.draft)
}

export async function saveQuoteProductMutation(params: {
  state: QuoteProductsControllerState
  resource: QuoteProductsResourceAdapter
  validationResult: SuccessfulDraftValidation
}): Promise<MutationSuccess> {
  const { state, resource, validationResult } = params

  if (state.editor.mode === 'create') {
    const created = await createQuoteProduct<QuoteProductRow>(validationResult.payload)
    const postCreateQuery = {
      family: normalizeQuoteProductFamily(created.data.family, state.activeFamily),
      status: 'all' as const,
      search: null,
    }

    const sourceProducts = resource.allKnownData ?? resource.data
    const nextProducts = [
      created.data,
      ...sourceProducts.filter(
        (product) => product.id !== created.data.id && quoteProductMatchesQuery(product, postCreateQuery)
      ),
    ]
    resource.setData(() => nextProducts)
    resource.setAllKnownData?.(() => [
      created.data,
      ...sourceProducts.filter((product) => product.id !== created.data.id),
    ])

    return {
      ok: true,
      action: {
        type: 'saveSuccess',
        row: created.data,
        notice: created.notice ?? 'Product created.',
        products: nextProducts,
      },
    }
  }

  const editEditor = state.editor
  if (editEditor.mode !== 'edit') {
    return {
      ok: false,
      error: 'Failed to save product.',
    }
  }

  const updated = await updateQuoteProduct<QuoteProductRow>(
    editEditor.targetId,
    validationResult.payload
  )

  const nextProducts = upsertProductIntoVisibleSlice(
    resource.data,
    updated.data,
    buildCurrentQuery(state),
    editEditor.targetId
  )
  resource.setData(() => nextProducts)
  resource.setAllKnownData?.((existing) =>
    upsertProductIntoVisibleSlice(existing, updated.data, { family: null, search: null, status: 'all' }, editEditor.targetId)
  )

  return {
    ok: true,
    action: {
      type: 'saveSuccess',
      row: quoteProductMatchesQuery(updated.data, buildCurrentQuery(state)) ? updated.data : null,
      notice: updated.notice ?? 'Product saved.',
      products: nextProducts,
    },
  }
}

export async function deleteQuoteProductMutation(params: {
  state: QuoteProductsControllerState
  resource: QuoteProductsResourceAdapter
}): Promise<MutationSuccess> {
  const { state, resource } = params
  const deleteTarget = state.deleteTarget

  if (!deleteTarget) {
    return {
      ok: false,
      error: 'Failed to delete product.',
    }
  }

  await deleteQuoteProduct(deleteTarget.id)
  const nextProducts = removeProductFromVisibleSlice(resource.data, deleteTarget.id)
  resource.setData(() => nextProducts)
  resource.setAllKnownData?.((existing) => removeProductFromVisibleSlice(existing, deleteTarget.id))

  return {
    ok: true,
    action: {
      type: 'deleteSuccess',
      deletedId: deleteTarget.id,
      notice: 'Product deleted.',
      products: nextProducts,
    },
  }
}

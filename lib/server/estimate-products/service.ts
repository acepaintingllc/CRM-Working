import {
  createEmptyQuoteProductDraft,
  isQuoteProductFamily,
  normalizeQuoteProductSearch,
  normalizeQuoteProductStatusFilter,
  quoteProductPatchToDraft,
  quoteProductRowToDraft,
  validateQuoteProductDraft,
  type QuoteProductRow,
} from '../../quotes/productsForm.ts'
import type { ServiceResult } from '../serviceResult.ts'
import {
  createEstimateProductRecord,
  deleteEstimateProductRecord,
  listEstimateProductRecords,
  loadEstimateProductRecord,
  updateEstimateProductRecord,
  type EstimateProductListFilters,
  type EstimateProductRepositoryDeps,
} from './repository.ts'

export type EstimateProductValidationFailure = {
  ok: false
  kind: 'invalid_input'
  message: string
  fields: Record<string, string>
}

export type EstimateProductMutationResult<T> =
  | ServiceResult<T>
  | EstimateProductValidationFailure

type EstimateProductServiceDeps = Partial<EstimateProductRepositoryDeps>

function toListFilters(searchParams?: URLSearchParams | null): EstimateProductListFilters {
  const requestedFamily = searchParams?.get('family')

  return {
    status: normalizeQuoteProductStatusFilter(searchParams?.get('status'), 'active'),
    family:
      requestedFamily && isQuoteProductFamily(requestedFamily) ? requestedFamily : null,
    search: normalizeQuoteProductSearch(searchParams?.get('search')),
  }
}

function validationFailure(summary: string | null | undefined, fields: Record<string, string>) {
  return {
    ok: false as const,
    kind: 'invalid_input' as const,
    message: summary ?? 'Invalid product payload.',
    fields,
  }
}

export function isEstimateProductValidationFailure(
  result: EstimateProductMutationResult<unknown>
): result is EstimateProductValidationFailure {
  return !result.ok && 'fields' in result
}

export async function listEstimateProducts(
  orgId: string,
  searchParams?: URLSearchParams | null,
  deps: EstimateProductServiceDeps = {}
): Promise<ServiceResult<QuoteProductRow[]>> {
  return listEstimateProductRecords(orgId, toListFilters(searchParams), deps)
}

export async function createEstimateProduct(
  orgId: string,
  body: Record<string, unknown>,
  deps: EstimateProductServiceDeps = {}
): Promise<EstimateProductMutationResult<QuoteProductRow>> {
  const validated = validateQuoteProductDraft({
    ...createEmptyQuoteProductDraft(),
    ...quoteProductPatchToDraft(body),
  })
  if (!validated.ok) {
    return validationFailure(validated.validation.summary, validated.validation.fields)
  }

  return createEstimateProductRecord(orgId, validated.payload, deps)
}

export async function updateEstimateProduct(
  orgId: string,
  productId: string,
  body: Record<string, unknown>,
  deps: EstimateProductServiceDeps = {}
): Promise<EstimateProductMutationResult<QuoteProductRow>> {
  const existingResult = await loadEstimateProductRecord(orgId, productId, deps)
  if (!existingResult.ok) return existingResult

  const validated = validateQuoteProductDraft({
    ...quoteProductRowToDraft(existingResult.data),
    ...quoteProductPatchToDraft(body),
  })
  if (!validated.ok) {
    return validationFailure(validated.validation.summary, validated.validation.fields)
  }

  return updateEstimateProductRecord(orgId, productId, validated.payload, deps)
}

export async function deleteEstimateProduct(
  orgId: string,
  productId: string,
  deps: EstimateProductServiceDeps = {}
): Promise<ServiceResult<true>> {
  const existingResult = await loadEstimateProductRecord(orgId, productId, deps)
  if (!existingResult.ok) return existingResult

  return deleteEstimateProductRecord(orgId, productId, deps)
}

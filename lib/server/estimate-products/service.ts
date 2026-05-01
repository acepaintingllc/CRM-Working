import {
  createEmptyQuoteProductDraft,
  isQuoteProductFamily,
  isQuoteProductScope,
  normalizeQuoteProductSearch,
  normalizeQuoteProductStatusFilter,
  quoteProductPatchToDraft,
  quoteProductRowToDraft,
  validateQuoteProductDraft,
  type QuoteProductRow,
} from '../../quotes/productsForm.ts'
import { errorResult, okResult, type ServiceResult } from '../serviceResult.ts'
import {
  archiveEstimateProductRecord,
  createEstimateProductRecord,
  deleteEstimateProductRecord,
  findEstimateProductReferences,
  listEstimateProductRecords,
  loadEstimateProductRecord,
  updateEstimateProductRecord,
  type EstimateProductReference,
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
  const requestedScope = searchParams?.get('scope')

  return {
    status: normalizeQuoteProductStatusFilter(searchParams?.get('status'), 'active'),
    family:
      requestedFamily && isQuoteProductFamily(requestedFamily) ? requestedFamily : null,
    scope: requestedScope && isQuoteProductScope(requestedScope) ? requestedScope : null,
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

function buildHardDeleteConflictMessage(references: EstimateProductReference[]) {
  const labels = references.map((reference) => reference.label)
  const uniqueLabels = [...new Set(labels)].join(', ')
  return `Product is still referenced by ${uniqueLabels}. Archive the product instead to keep quote defaults and historical estimates intact.`
}

function isArchiveOnlyPatch(
  body: Record<string, unknown>,
  patch: Partial<ReturnType<typeof quoteProductPatchToDraft>>
) {
  const keys = Object.keys(body)
  return keys.length === 1 && keys[0] === 'status' && patch.status === 'Archived'
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

  const draftPatch = quoteProductPatchToDraft(body)
  if (isArchiveOnlyPatch(body, draftPatch)) {
    if (existingResult.data.status === 'Archived') {
      return okResult(existingResult.data)
    }

    return archiveEstimateProductRecord(orgId, productId, deps)
  }

  const validated = validateQuoteProductDraft({
    ...quoteProductRowToDraft(existingResult.data),
    ...draftPatch,
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

  const referenceResult = await findEstimateProductReferences(orgId, productId, deps)
  if (!referenceResult.ok) return referenceResult
  if (referenceResult.data.length > 0) {
    return errorResult('conflict', buildHardDeleteConflictMessage(referenceResult.data))
  }

  return deleteEstimateProductRecord(orgId, productId, deps)
}

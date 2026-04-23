import {
  isQuoteProductFamily,
  type ProductFamily,
  type QuoteProductPayload,
  type QuoteProductRow,
  type QuoteProductStatusFilter,
} from '../../quotes/productsForm.ts'
import { supabaseAdmin } from '../org.ts'
import { errorResult, okResult, type ServiceResult } from '../serviceResult.ts'

type EstimateProductsQueryError = {
  message: string
}

type EstimateProductRowResult = {
  data: EstimateProductRecord[] | null
  error: EstimateProductsQueryError | null
}

type SingleEstimateProductResult = {
  data: EstimateProductRecord | null
  error: EstimateProductsQueryError | null
}

type EstimateProductQuery = {
  eq(column: string, value: string): EstimateProductQuery
  or(condition: string): EstimateProductQuery
  order(column: string, options: { ascending: boolean }): Promise<EstimateProductRowResult>
  select(columns?: string): EstimateProductQuery
  single(): Promise<SingleEstimateProductResult>
  insert(rows: Partial<EstimateProductRecord>[]): EstimateProductQuery
  update(updates: Record<string, unknown>): EstimateProductQuery
  delete(): EstimateProductQuery
}

export type EstimateProductRepositoryDeps = {
  client: {
    from: (relation: string) => unknown
  }
}

export type EstimateProductListFilters = {
  status: QuoteProductStatusFilter
  family?: ProductFamily | null
  search?: string | null
}

export type EstimateProductRecord = QuoteProductRow & {
  org_id: string
}

const defaultDeps: EstimateProductRepositoryDeps = {
  client: supabaseAdmin,
}

function withDeps(
  overrides?: Partial<EstimateProductRepositoryDeps>
): EstimateProductRepositoryDeps {
  return {
    ...defaultDeps,
    ...overrides,
  }
}

function statusFilterToRecordStatus(status: QuoteProductStatusFilter) {
  const statusMap = {
    active: 'Active',
    inactive: 'Inactive',
    archived: 'Archived',
  } as const

  return status === 'all' ? null : statusMap[status]
}

export async function listEstimateProductRecords(
  orgId: string,
  filters: EstimateProductListFilters,
  deps: Partial<EstimateProductRepositoryDeps> = {}
): Promise<ServiceResult<EstimateProductRecord[]>> {
  const { client } = withDeps(deps)

  try {
    let query = (client.from('v2_products') as EstimateProductQuery).select('*').eq('org_id', orgId)

    const status = statusFilterToRecordStatus(filters.status)
    if (status) {
      query = query.eq('status', status)
    }

    if (filters.family && isQuoteProductFamily(filters.family)) {
      query = query.eq('family', filters.family)
    }

    const requestedSearch = String(filters.search ?? '').trim()
    if (requestedSearch) {
      const sanitizedSearch = requestedSearch.replace(/[%_,]/g, '')
      if (sanitizedSearch) {
        const pattern = `%${sanitizedSearch}%`
        query = query.or(
          [
            `name.ilike.${pattern}`,
            `base.ilike.${pattern}`,
            `subtype.ilike.${pattern}`,
            `notes.ilike.${pattern}`,
            `status.ilike.${pattern}`,
          ].join(',')
        )
      }
    }

    const { data, error } = await (query.order('created_at', { ascending: false }) as Promise<EstimateProductRowResult>)
    if (error) return errorResult('invalid_input', error.message)

    return okResult((data ?? []) as EstimateProductRecord[])
  } catch (error) {
    return errorResult(
      'server_error',
      error instanceof Error ? error.message : 'Failed to fetch products'
    )
  }
}

export async function loadEstimateProductRecord(
  orgId: string,
  productId: string,
  deps: Partial<EstimateProductRepositoryDeps> = {}
): Promise<ServiceResult<EstimateProductRecord>> {
  const { client } = withDeps(deps)

  try {
    const query = client.from('v2_products') as EstimateProductQuery
    const { data, error } = await (query
      .select('*')
      .eq('id', productId)
      .eq('org_id', orgId)
      .single() as Promise<SingleEstimateProductResult>)

    if (error || !data) {
      return errorResult('not_found', 'Product not found')
    }

    return okResult(data as EstimateProductRecord)
  } catch (error) {
    return errorResult(
      'server_error',
      error instanceof Error ? error.message : 'Failed to fetch product'
    )
  }
}

export async function createEstimateProductRecord(
  orgId: string,
  payload: QuoteProductPayload,
  deps: Partial<EstimateProductRepositoryDeps> = {}
): Promise<ServiceResult<EstimateProductRecord>> {
  const { client } = withDeps(deps)

  try {
    const query = client.from('v2_products') as EstimateProductQuery
    const { data, error } = await (query
      .insert([
        {
          org_id: orgId,
          ...payload,
        },
      ])
      .select()
      .single() as Promise<SingleEstimateProductResult>)

    if (error) return errorResult('invalid_input', error.message)

    return okResult(data as EstimateProductRecord)
  } catch (error) {
    return errorResult(
      'server_error',
      error instanceof Error ? error.message : 'Failed to create product'
    )
  }
}

export async function updateEstimateProductRecord(
  orgId: string,
  productId: string,
  payload: QuoteProductPayload,
  deps: Partial<EstimateProductRepositoryDeps> = {}
): Promise<ServiceResult<EstimateProductRecord>> {
  const { client } = withDeps(deps)

  try {
    const query = client.from('v2_products') as EstimateProductQuery
    const { data, error } = await (query
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .eq('org_id', orgId)
      .select()
      .single() as Promise<SingleEstimateProductResult>)

    if (error) return errorResult('invalid_input', error.message)

    return okResult(data as EstimateProductRecord)
  } catch (error) {
    return errorResult(
      'server_error',
      error instanceof Error ? error.message : 'Failed to update product'
    )
  }
}

export async function deleteEstimateProductRecord(
  orgId: string,
  productId: string,
  deps: Partial<EstimateProductRepositoryDeps> = {}
): Promise<ServiceResult<true>> {
  const { client } = withDeps(deps)

  try {
    const query = client.from('v2_products') as EstimateProductQuery
    const { error } = (await (query.delete().eq('id', productId).eq('org_id', orgId)) as unknown as {
      error: EstimateProductsQueryError | null
    })

    if (error) return errorResult('invalid_input', error.message)

    return okResult(true)
  } catch (error) {
    return errorResult(
      'server_error',
      error instanceof Error ? error.message : 'Failed to delete product'
    )
  }
}

import {
  isQuoteProductFamily,
  type ProductFamily,
  type QuoteProductPayload,
  type QuoteProductRow,
  type QuoteProductScope,
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

type EstimateProductReferenceRowResult = {
  data: Array<Record<string, unknown>> | null
  error: EstimateProductsQueryError | null
}

type EstimateProductSnapshotRow = {
  id: string
  payload_json: unknown
}

type EstimateProductSnapshotRowResult = {
  data: EstimateProductSnapshotRow[] | null
  error: EstimateProductsQueryError | null
}

type SingleEstimateProductResult = {
  data: EstimateProductRecord | null
  error: EstimateProductsQueryError | null
}

type EstimateProductQuery = {
  eq(column: string, value: string): EstimateProductQuery
  contains(column: string, value: string[]): EstimateProductQuery
  or(condition: string): EstimateProductQuery
  order(column: string, options: { ascending: boolean }): Promise<EstimateProductRowResult>
  select(columns?: string): EstimateProductQuery
  limit(count: number): EstimateProductQuery
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
  scope?: QuoteProductScope | null
  search?: string | null
}

export type EstimateProductRecord = QuoteProductRow & {
  org_id: string
}

export type EstimateProductReference = {
  source:
    | 'quote_defaults'
    | 'estimate_defaults'
    | 'wall_scopes'
    | 'ceiling_scopes'
    | 'trim_scopes'
    | 'material_requirements'
    | 'material_purchase_groups'
    | 'catalog_snapshots'
  label: string
}

const PRODUCT_REFERENCE_QUERIES: Array<{
  source: Exclude<EstimateProductReference['source'], 'catalog_snapshots'>
  label: string
  relation: string
  columns: string[]
}> = [
  {
    source: 'quote_defaults',
    label: 'quote defaults',
    relation: 'estimate_template_settings',
    columns: [
      'walls_paint_id',
      'walls_primer_id',
      'ceiling_paint_id',
      'ceiling_primer_id',
      'trim_paint_id',
      'trim_primer_id',
    ],
  },
  {
    source: 'estimate_defaults',
    label: 'saved estimate defaults',
    relation: 'estimate_jobsettings',
    columns: [
      'walls_paint_id',
      'walls_primer_id',
      'ceiling_paint_id',
      'ceiling_primer_id',
      'trim_paint_id',
      'trim_primer_id',
      'primer_id',
    ],
  },
  {
    source: 'wall_scopes',
    label: 'wall scope product selections',
    relation: 'estimate_room_wall_scopes',
    columns: ['paint_product_id', 'primer_product_id'],
  },
  {
    source: 'ceiling_scopes',
    label: 'ceiling scope product selections',
    relation: 'estimate_room_ceiling_scopes',
    columns: ['paint_product_id', 'primer_product_id'],
  },
  {
    source: 'trim_scopes',
    label: 'trim scope product selections',
    relation: 'estimate_room_trim_scopes',
    columns: ['paint_product_id', 'primer_product_id'],
  },
  {
    source: 'material_requirements',
    label: 'material requirements',
    relation: 'estimate_material_requirements',
    columns: ['product_id'],
  },
  {
    source: 'material_purchase_groups',
    label: 'material purchase groups',
    relation: 'estimate_material_purchase_groups',
    columns: ['product_id'],
  },
]

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

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, '\\$&')
}

function quotePostgrestFilterValue(value: string) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function buildProductSearchPattern(search: string) {
  return quotePostgrestFilterValue(`%${escapeLikePattern(search)}%`)
}

function buildReferenceOrCondition(columns: string[], productId: string) {
  const value = quotePostgrestFilterValue(productId)
  return columns.map((column) => `${column}.eq.${value}`).join(',')
}

function payloadContainsProductId(payload: unknown, productId: string): boolean {
  if (typeof payload === 'string') return payload === productId
  if (Array.isArray(payload)) {
    return payload.some((item) => payloadContainsProductId(item, productId))
  }
  if (!payload || typeof payload !== 'object') return false
  return Object.values(payload as Record<string, unknown>).some((value) =>
    payloadContainsProductId(value, productId)
  )
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

    if (filters.scope) {
      query = query.contains('default_scopes', [filters.scope])
    }

    const requestedSearch = String(filters.search ?? '').trim()
    if (requestedSearch) {
      const pattern = buildProductSearchPattern(requestedSearch)
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

export async function findEstimateProductReferences(
  orgId: string,
  productId: string,
  deps: Partial<EstimateProductRepositoryDeps> = {}
): Promise<ServiceResult<EstimateProductReference[]>> {
  const { client } = withDeps(deps)
  const references: EstimateProductReference[] = []

  try {
    for (const referenceQuery of PRODUCT_REFERENCE_QUERIES) {
      const query = client.from(referenceQuery.relation) as EstimateProductQuery
      const { data, error } = await (query
        .select('id')
        .eq('org_id', orgId)
        .or(buildReferenceOrCondition(referenceQuery.columns, productId))
        .limit(1) as unknown as Promise<EstimateProductReferenceRowResult>)

      if (error) {
        return errorResult(
          'server_error',
          `Failed to check ${referenceQuery.label}: ${error.message}`
        )
      }

      if ((data ?? []).length > 0) {
        references.push({
          source: referenceQuery.source,
          label: referenceQuery.label,
        })
      }
    }

    const snapshotQuery = client.from('v2_catalog_snapshots') as EstimateProductQuery
    const { data: snapshots, error: snapshotError } = await (snapshotQuery
      .select('id,payload_json')
      .eq('org_id', orgId) as unknown as Promise<EstimateProductSnapshotRowResult>)

    if (snapshotError) {
      return errorResult(
        'server_error',
        `Failed to check catalog snapshots: ${snapshotError.message}`
      )
    }

    if ((snapshots ?? []).some((snapshot) => payloadContainsProductId(snapshot.payload_json, productId))) {
      references.push({
        source: 'catalog_snapshots',
        label: 'catalog snapshots',
      })
    }

    return okResult(references)
  } catch (error) {
    return errorResult(
      'server_error',
      error instanceof Error ? error.message : 'Failed to check product references'
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

export async function archiveEstimateProductRecord(
  orgId: string,
  productId: string,
  deps: Partial<EstimateProductRepositoryDeps> = {}
): Promise<ServiceResult<EstimateProductRecord>> {
  const { client } = withDeps(deps)

  try {
    const query = client.from('v2_products') as EstimateProductQuery
    const { data, error } = await (query
      .update({
        status: 'Archived',
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
      error instanceof Error ? error.message : 'Failed to archive product'
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

import { NextResponse } from 'next/server'
import {
  createEmptyQuoteProductDraft,
  isQuoteProductFamily,
  normalizeQuoteProductSearch,
  normalizeQuoteProductStatusFilter,
  quoteProductPatchToDraft,
  quoteProductRowToDraft,
  validateQuoteProductDraft,
  type QuoteProductStatusFilter,
  type QuoteProductRow,
} from '@/lib/quotes/productsForm'
import {
  jsonError,
  readJsonBody,
  readUuidParam,
  requireSessionUserOrg,
  resolveParams,
} from '@/lib/server/apiRoute'
import { supabaseAdmin } from '@/lib/server/org'
import { dataResponse, mutationResponse } from '@/lib/server/routeResult'

type EstimateProductRouteContext = {
  params: { id: string } | Promise<{ id: string }>
}

type V2Product = {
  id: string
  org_id: string
  name: string
  family?: string | null
  base?: string | null
  subtype?: string | null
  cost_per_unit?: number | null
  coverage_sqft_per_gal_per_coat?: number | null
  efficiency_pct?: number | null
  default_coats?: number | null
  default_sheen?: string | null
  default_scopes?: string[] | null
  notes?: string | null
  status: string
  created_at: string
  updated_at: string
}

function validationErrorResponse(validation: {
  summary?: string | null
  fields: Record<string, string>
}) {
  return NextResponse.json(
    {
      error: validation.summary ?? 'Invalid product payload.',
      fields: validation.fields,
    },
    { status: 400 }
  )
}

export async function handleEstimateProductsRouteGet(request?: Request) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const searchParams = request ? new URL(request.url).searchParams : null
  const requestedStatus = searchParams
    ? normalizeQuoteProductStatusFilter(searchParams.get('status'), 'active')
    : ('active' as QuoteProductStatusFilter)
  const requestedFamily = searchParams?.get('family')
  const requestedSearch = normalizeQuoteProductSearch(searchParams?.get('search'))

  try {
    let query = supabaseAdmin
      .from('v2_products')
      .select('*')
      .eq('org_id', auth.session.orgId)

    if (requestedStatus !== 'all') {
      const statusMap = {
        active: 'Active',
        inactive: 'Inactive',
        archived: 'Archived',
      } as const
      query = query.eq('status', statusMap[requestedStatus])
    }

    if (requestedFamily && isQuoteProductFamily(requestedFamily)) {
      query = query.eq('family', requestedFamily)
    }

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

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) return jsonError(error.message, 400)

    return dataResponse(data as V2Product[])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch products'
    return jsonError(message, 500)
  }
}

export async function handleEstimateProductsRoutePost(request: Request) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const body = await readJsonBody<Record<string, unknown>>(request)
  if (!body.ok) return body.response

  const validated = validateQuoteProductDraft({
    ...createEmptyQuoteProductDraft(),
    ...quoteProductPatchToDraft(body.value),
  })
  if (!validated.ok) {
    return validationErrorResponse(validated.validation)
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('v2_products')
      .insert([
        {
          org_id: auth.session.orgId,
          ...validated.payload,
        },
      ])
      .select()
      .single()

    if (error) return jsonError(error.message, 400)

    return mutationResponse(data as V2Product, 'Product created.', { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create product'
    return jsonError(message, 500)
  }
}

export async function handleEstimateProductRoutePatch(
  request: Request,
  context: EstimateProductRouteContext
) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const params = await resolveParams(context)
  const idResult = readUuidParam(params?.id, 'product id')
  if (!idResult.ok) return idResult.response

  const bodyResult = await readJsonBody<Record<string, unknown>>(request)
  if (!bodyResult.ok) return bodyResult.response

  try {
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('v2_products')
      .select('*')
      .eq('id', idResult.value)
      .eq('org_id', auth.session.orgId)
      .single()

    if (fetchError || !existing) {
      return jsonError('Product not found', 404)
    }

    const validated = validateQuoteProductDraft({
      ...quoteProductRowToDraft(existing as QuoteProductRow),
      ...quoteProductPatchToDraft(bodyResult.value),
    })
    if (!validated.ok) {
      return validationErrorResponse(validated.validation)
    }

    const { data, error } = await supabaseAdmin
      .from('v2_products')
      .update({
        ...validated.payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', idResult.value)
      .eq('org_id', auth.session.orgId)
      .select()
      .single()

    if (error) return jsonError(error.message, 400)

    return mutationResponse(data as V2Product, 'Product updated.')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update product'
    return jsonError(message, 500)
  }
}

export async function handleEstimateProductRouteDelete(
  _request: Request,
  context: EstimateProductRouteContext
) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const params = await resolveParams(context)
  const idResult = readUuidParam(params?.id, 'product id')
  if (!idResult.ok) return idResult.response

  try {
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('v2_products')
      .select('*')
      .eq('id', idResult.value)
      .eq('org_id', auth.session.orgId)
      .single()

    if (fetchError || !existing) {
      return jsonError('Product not found', 404)
    }

    const { error } = await supabaseAdmin
      .from('v2_products')
      .delete()
      .eq('id', idResult.value)
      .eq('org_id', auth.session.orgId)

    if (error) return jsonError(error.message, 400)

    return mutationResponse(true, 'Product deleted.')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete product'
    return jsonError(message, 500)
  }
}

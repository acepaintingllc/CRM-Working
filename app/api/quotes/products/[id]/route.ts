import { NextResponse } from 'next/server'
import {
  jsonError,
  readJsonBody,
  readUuidParam,
  requireSessionUserOrg,
} from '@/lib/server/apiRoute'
import {
  quoteProductPatchToDraft,
  quoteProductRowToDraft,
  validateQuoteProductDraft,
  type QuoteProductRow,
} from '@/lib/quotes/productsForm'
import { supabaseAdmin } from '@/lib/server/org'

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

export async function PATCH(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const params = await Promise.resolve(context.params)
  const idResult = readUuidParam((params as { id?: string } | null | undefined)?.id, 'product id')
  if (!idResult.ok) return idResult.response

  const bodyResult = await readJsonBody<Record<string, unknown>>(request)
  if (!bodyResult.ok) return bodyResult.response

  try {
    // First verify the product belongs to the user's org
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('v2_products')
      .select('*')
      .eq('id', idResult.value)
      .eq('org_id', auth.session.orgId)
      .single()

    if (fetchError || !existing) {
      return jsonError('Product not found', 404)
    }

    const mergedDraft = {
      ...quoteProductRowToDraft(existing as QuoteProductRow),
      ...quoteProductPatchToDraft(bodyResult.value),
    }
    const validated = validateQuoteProductDraft(mergedDraft)
    if (!validated.ok) {
      return NextResponse.json(
        {
          error: validated.validation.summary ?? 'Invalid product payload.',
          fields: validated.validation.fields,
        },
        { status: 400 }
      )
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

    if (error) {
      return jsonError(error.message, 400)
    }

    return NextResponse.json({
      data: data as V2Product,
      notice: 'Product updated.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update product'
    return jsonError(message, 500)
  }
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const params = await Promise.resolve(context.params)
  const idResult = readUuidParam((params as { id?: string } | null | undefined)?.id, 'product id')
  if (!idResult.ok) return idResult.response

  try {
    // First verify the product belongs to the user's org
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

    if (error) {
      return jsonError(error.message, 400)
    }

    return NextResponse.json({
      data: true,
      notice: 'Product deleted.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete product'
    return jsonError(message, 500)
  }
}

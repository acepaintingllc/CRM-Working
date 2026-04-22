import { NextResponse } from 'next/server'
import { getSessionUserOrg } from '@/lib/server/org'
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

export async function GET() {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('v2_products')
      .select('*')
      .eq('org_id', session.orgId)
      .eq('status', 'Active')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ data: data as V2Product[] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch products'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  try {
    const body = await request.json()
    const { name, family, base, subtype, cost_per_unit, coverage_sqft_per_gal_per_coat, efficiency_pct, default_coats, default_sheen, default_scopes, notes, status } = body

    const { data, error } = await supabaseAdmin
      .from('v2_products')
      .insert([
        {
          org_id: session.orgId,
          name,
          family,
          base,
          subtype,
          cost_per_unit,
          coverage_sqft_per_gal_per_coat,
          efficiency_pct,
          default_coats,
          default_sheen,
          default_scopes,
          notes,
          status: status || 'Active',
        },
      ])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      {
        data: data as V2Product,
        notice: 'Product created.',
      },
      { status: 201 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create product'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

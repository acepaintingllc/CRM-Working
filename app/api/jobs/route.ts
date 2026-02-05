import { NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUserOrg } from '@/lib/server/org'

export async function GET() {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const { orgId } = session

  // Avoid relying on PostgREST embedded joins (jobs -> customers) because they require
  // a FK relationship that may not exist yet in the DB while the schema is evolving.
  const { data, error } = await supabaseAdmin
    .from('jobs')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
        details: (error as any).details ?? null,
        hint: (error as any).hint ?? null,
        code: (error as any).code ?? null,
      },
      { status: 500 }
    )
  }

  const rows: any[] = data ?? []
  const customerIds = Array.from(new Set(rows.map((r) => r.customer_id).filter(Boolean)))

  let customerById = new Map<string, { name: string | null; address: string | null }>()
  if (customerIds.length) {
    const { data: customers, error: cErr } = await supabaseAdmin
      .from('customers')
      .select('id, name, address')
      .eq('org_id', orgId)
      .in('id', customerIds)

    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

    for (const c of customers ?? []) {
      customerById.set(c.id, { name: (c as any).name ?? null, address: (c as any).address ?? null })
    }
  }

  const jobs = rows.map((row: any) => {
    const customer = row.customer_id ? customerById.get(row.customer_id) : undefined
    return {
      ...row,
      // Be defensive if older rows/schemas exist.
      title: row.title ?? 'Untitled job',
      status: row.status ?? 'estimate_scheduled',
      customer_name: customer?.name ?? null,
      customer_address: customer?.address ?? null,
    }
  })

  return NextResponse.json({ jobs })
}

export async function POST(request: Request) {
  try {
    const session = await getSessionUserOrg()
    if ('error' in session) {
      const status = session.error === 'Not authenticated' ? 401 : 403
      return NextResponse.json({ error: session.error }, { status })
    }

    const { orgId } = session
    const body = await request.json().catch(() => null)

    if (!body?.customer_id || !body?.title) {
      return NextResponse.json(
        { error: 'Missing customer_id or title' },
        { status: 400 }
      )
    }

    const status = (body.status as string) || 'estimate_scheduled'

    // Build payload defensively. If a column doesn't exist yet in the DB (schema still evolving),
    // including it (even as null) will cause PostgREST errors. Only send provided non-null fields.
    const insertPayload: Record<string, any> = {
      org_id: orgId,
      customer_id: body.customer_id,
      title: String(body.title),
      description: body.description ? String(body.description) : null,
      status,
    }

    for (const key of [
      'estimate_date',
      'estimate_sent_at',
      'scheduled_date',
      'completed_at',
    ]) {
      if (body[key] !== undefined && body[key] !== null) {
        insertPayload[key] = body[key]
      }
    }

    const insertOnce = async (payload: Record<string, any>) => {
      return supabaseAdmin
        .from('jobs')
        .insert(payload)
        // Use "*" to avoid schema-cache failures when columns are still being added/migrated.
        .select('*')
        .single()
    }

    let { data, error } = await insertOnce(insertPayload)

    if (error) {
      const msg = error.message ?? ''

      // Common schema drift cases:
      // - "property_id" exists and is NOT NULL (older schema)
      // - "customer_id" column doesn't exist (older schema)
      const needsPropertyId = msg.includes('property_id') && msg.includes('null value')
      const missingCustomerId = msg.includes('customer_id') && msg.includes('does not exist')

      if (needsPropertyId || missingCustomerId) {
        const retryPayload: Record<string, any> = { ...insertPayload }
        // Some schemas require both customer_id and property_id. If customer_id doesn't exist,
        // we must omit it. Otherwise, keep it and also set property_id.
        if (missingCustomerId) {
          delete retryPayload.customer_id
        }

        // If the schema enforces a FK to "properties", create (or re-use) a property row first.
        let propertyId: string | null = null
        try {
          // Try to find an existing property linked to this customer (if the column exists).
          const lookup = await supabaseAdmin
            .from('properties')
            .select('id')
            .eq('org_id', orgId)
            .eq('customer_id', body.customer_id)
            .limit(1)
            .maybeSingle()

          if (!lookup.error && lookup.data?.id) {
            propertyId = lookup.data.id as any
          }
        } catch {
          // ignore and attempt insert
        }

        if (!propertyId) {
          // Fetch the customer to populate common property fields (best effort).
          const { data: customer } = await supabaseAdmin
            .from('customers')
            .select('id, name, address')
            .eq('org_id', orgId)
            .eq('id', body.customer_id)
            .maybeSingle()

          const addr = ((customer as any)?.address ?? '') as string
          const parts = addr.split(',').map((p) => p.trim()).filter(Boolean)
          const street = parts[0] ?? 'Unknown'
          const city = parts[1] ?? 'Unknown'
          const stateZip = parts[2] ?? ''
          const stateMatch = stateZip.match(/([A-Za-z]{2})/)
          const zipMatch = stateZip.match(/(\d{5})(?:-\d{4})?/)

          const base: Record<string, any> = {
            org_id: orgId,
            customer_id: body.customer_id,
            name: (customer as any)?.name ?? 'Property',
            street,
            city,
            state: stateMatch?.[1] ?? 'NA',
            zip: zipMatch?.[1] ?? '00000',
          }
          if (!(base as any).full_address) {
            const fullAddress = [street, city, [base.state, base.zip].join(' ').trim()]
              .filter(Boolean)
              .join(', ')
            if (fullAddress) {
              base.full_address = fullAddress
            }
          }

          // Retry loop that strips unknown columns if your properties schema differs.
          let propPayload: Record<string, any> = { ...base }
          for (let i = 0; i < 6; i++) {
            const created = await supabaseAdmin
              .from('properties')
              .insert(propPayload)
              .select('id')
              .single()

            if (!created.error) {
              propertyId = (created.data as any).id
              break
            }

            const emsg = created.error.message ?? ''
            const m =
              emsg.match(/column \"([a-zA-Z0-9_]+)\" of relation \"properties\" does not exist/i) ||
              emsg.match(/Could not find the '([a-zA-Z0-9_]+)' column of 'properties'/i)
            if (m?.[1] && m[1] in propPayload) {
              delete propPayload[m[1]]
              continue
            }

            return NextResponse.json(
              {
                error: created.error.message,
                details: (created.error as any).details ?? null,
                hint: (created.error as any).hint ?? null,
                code: (created.error as any).code ?? null,
              },
              { status: 500 }
            )
          }
        }

        if (propertyId) {
          retryPayload.property_id = propertyId
        }

        const retry = await insertOnce(retryPayload)
        data = retry.data as any
        error = retry.error as any
      }
    }

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          details: (error as any).details ?? null,
          hint: (error as any).hint ?? null,
          code: (error as any).code ?? null,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, job: data })
  } catch (e: any) {
    return NextResponse.json(
      {
        error: e?.message ?? 'Unhandled error creating job',
        details: e?.stack ?? null,
      },
      { status: 500 }
    )
  }
}

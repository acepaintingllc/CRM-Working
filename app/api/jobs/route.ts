import { NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUserOrg } from '@/lib/server/org'

type JobRow = {
  customer_id?: string | null
  title?: string | null
  status?: string | null
  [key: string]: unknown
}

type CustomerRow = {
  id: string
  name?: string | null
  address?: string | null
}

type JobScheduleRow = {
  job_id: string
  start_at: string | null
  end_at: string | null
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : null
}

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
    return NextResponse.json({ error: 'Unable to load jobs.' }, { status: 500 })
  }

  const rows = (data ?? []) as JobRow[]
  const jobIds = rows
    .map((r) => asString(r.id))
    .filter((v): v is string => Boolean(v))
  const customerIds = Array.from(new Set(rows.map((r) => r.customer_id).filter(Boolean)))

  const customerById = new Map<string, { name: string | null; address: string | null }>()
  if (customerIds.length) {
    const { data: customers, error: cErr } = await supabaseAdmin
      .from('customers')
      .select('id, name, address')
      .eq('org_id', orgId)
      .in('id', customerIds)

    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

    for (const c of (customers ?? []) as CustomerRow[]) {
      customerById.set(c.id, { name: c.name ?? null, address: c.address ?? null })
    }
  }

  const scheduleByJob = new Map<string, { minStart: string | null; maxEnd: string | null }>()
  if (jobIds.length) {
    const { data: schedules, error: schedErr } = await supabaseAdmin
      .from('job_schedules')
      .select('job_id, start_at, end_at')
      .eq('org_id', orgId)
      .in('job_id', jobIds)

    if (schedErr) return NextResponse.json({ error: schedErr.message }, { status: 500 })

    for (const row of (schedules ?? []) as JobScheduleRow[]) {
      const current = scheduleByJob.get(row.job_id) ?? { minStart: null, maxEnd: null }
      if (row.start_at && (!current.minStart || row.start_at < current.minStart)) {
        current.minStart = row.start_at
      }
      if (row.end_at && (!current.maxEnd || row.end_at > current.maxEnd)) {
        current.maxEnd = row.end_at
      }
      scheduleByJob.set(row.job_id, current)
    }
  }

  const jobs = rows.map((row) => {
    const customer = row.customer_id ? customerById.get(row.customer_id) : undefined
    const id = asString(row.id)
    const scheduleRange = id ? scheduleByJob.get(id) : undefined
    const rowScheduledDate = asString(row.scheduled_date)
    const rowScheduledEndDate = asString(row.scheduled_end_date)
    const scheduledDate = rowScheduledDate ?? scheduleRange?.minStart ?? null
    const scheduledEndDate = rowScheduledEndDate ?? scheduleRange?.maxEnd ?? null
    return {
      ...row,
      // Be defensive if older rows/schemas exist.
      title: row.title ?? 'Untitled job',
      status: row.status ?? 'estimate_scheduled',
      customer_name: customer?.name ?? null,
      customer_address: customer?.address ?? null,
      scheduled_date: scheduledDate,
      scheduled_end_date: scheduledEndDate,
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
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const customerId = asString(body.customer_id)
    const title = asString(body.title)
    if (!customerId || !title) {
      return NextResponse.json(
        { error: 'Missing customer_id or title' },
        { status: 400 }
      )
    }

    const status = asString(body.status) || 'estimate_scheduled'

    // Build payload defensively. If a column doesn't exist yet in the DB (schema still evolving),
    // including it (even as null) will cause PostgREST errors. Only send provided non-null fields.
    const insertPayload: Record<string, unknown> = {
      org_id: orgId,
      customer_id: customerId,
      title,
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

    const insertOnce = async (payload: Record<string, unknown>) => {
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
        const retryPayload: Record<string, unknown> = { ...insertPayload }
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
            .eq('customer_id', customerId)
            .limit(1)
            .maybeSingle()

          if (!lookup.error && lookup.data?.id) {
            propertyId = String(lookup.data.id)
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
            .eq('id', customerId)
            .maybeSingle()

          const customerRow = (customer ?? null) as { name?: string | null; address?: string | null } | null
          const addr = customerRow?.address ?? ''
          const parts = addr.split(',').map((p) => p.trim()).filter(Boolean)
          const street = parts[0] ?? 'Unknown'
          const city = parts[1] ?? 'Unknown'
          const stateZip = parts[2] ?? ''
          const stateMatch = stateZip.match(/([A-Za-z]{2})/)
          const zipMatch = stateZip.match(/(\d{5})(?:-\d{4})?/)

          const base: Record<string, unknown> = {
            org_id: orgId,
            customer_id: customerId,
            name: customerRow?.name ?? 'Property',
            street,
            city,
            state: stateMatch?.[1] ?? 'NA',
            zip: zipMatch?.[1] ?? '00000',
          }
          if (!base.full_address) {
            const fullAddress = [street, city, [base.state, base.zip].join(' ').trim()]
              .filter(Boolean)
              .join(', ')
            if (fullAddress) {
              base.full_address = fullAddress
            }
          }

          // Retry loop that strips unknown columns if your properties schema differs.
          const propPayload: Record<string, unknown> = { ...base }
          for (let i = 0; i < 6; i++) {
            const created = await supabaseAdmin
              .from('properties')
              .insert(propPayload)
              .select('id')
              .single()

            if (!created.error) {
              propertyId = String((created.data as { id?: string | null } | null)?.id ?? '')
              if (!propertyId) propertyId = null
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

            return NextResponse.json({ error: 'Unable to create property for job.' }, { status: 500 })
          }
        }

        if (propertyId) {
          retryPayload.property_id = propertyId
        }

        const retry = await insertOnce(retryPayload)
        data = retry.data
        error = retry.error
      }
    }

    if (error) {
      return NextResponse.json({ error: 'Unable to create job.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, job: data })
  } catch (e: unknown) {
    return NextResponse.json({ error: 'Unable to create job.' }, { status: 500 })
  }
}

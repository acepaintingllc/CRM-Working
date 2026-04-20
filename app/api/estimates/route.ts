import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import { createEstimateRatesFlagsCatalogSnapshot } from '@/lib/server/estimateRatesFlags'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const VERSION_STATES = new Set(['draft', 'live', 'archived'])
const VERSION_KINDS = new Set(['standard', 'alternate', 'split', 'combined', 'revision'])

function asText(value: unknown) {
  return String(value ?? '').trim()
}

function asOptionalNumber(value: unknown) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export async function GET() {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const { orgId } = session
  const { data: estimates, error } = await supabaseAdmin
    .from('estimates')
    .select(
      'id, job_id, customer_id, status, version_name, version_state, version_kind, version_sort_order, sheet_schema_version, sheet_file_path, latest_output_json, created_at, updated_at'
    )
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const jobIds = Array.from(new Set((estimates ?? []).map((row) => row.job_id).filter(Boolean)))
  const customerIds = Array.from(
    new Set((estimates ?? []).map((row) => row.customer_id).filter(Boolean))
  )

  const [jobsRes, customersRes] = await Promise.all([
    jobIds.length
      ? supabaseAdmin
          .from('jobs')
          .select('id, title, status, estimate_sent_at')
          .eq('org_id', orgId)
          .in('id', jobIds)
      : Promise.resolve({ data: [], error: null }),
    customerIds.length
      ? supabaseAdmin
          .from('customers')
          .select('id, name')
          .eq('org_id', orgId)
          .in('id', customerIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (jobsRes.error) return NextResponse.json({ error: jobsRes.error.message }, { status: 500 })
  if (customersRes.error) {
    return NextResponse.json({ error: customersRes.error.message }, { status: 500 })
  }

  const jobs = new Map(
    (jobsRes.data ?? []).map((j) => [
      j.id,
      {
        title: j.title ?? null,
        status: j.status ?? null,
        estimate_sent_at: j.estimate_sent_at ?? null,
      },
    ])
  )
  const customers = new Map((customersRes.data ?? []).map((c) => [c.id, c.name]))

  return NextResponse.json({
    estimates: (estimates ?? []).map((row) => ({
      ...row,
      job_title: jobs.get(row.job_id)?.title ?? null,
      job_status: jobs.get(row.job_id)?.status ?? null,
      job_estimate_sent_at: jobs.get(row.job_id)?.estimate_sent_at ?? null,
      is_sent_estimate: Boolean(
        jobs.get(row.job_id)?.estimate_sent_at || jobs.get(row.job_id)?.status === 'estimate_sent'
      ),
      customer_name: customers.get(row.customer_id) ?? null,
    })),
  })
}

export async function POST(request: Request) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Missing body' }, { status: 400 })

  const jobId = String(body.job_id ?? '').trim()
  if (!uuid.test(jobId)) return NextResponse.json({ error: 'Invalid job_id' }, { status: 400 })

  const { orgId, userId } = session
  const jobRes = await supabaseAdmin
    .from('jobs')
    .select('id, customer_id')
    .eq('org_id', orgId)
    .eq('id', jobId)
    .maybeSingle()

  if (jobRes.error) return NextResponse.json({ error: jobRes.error.message }, { status: 500 })
  if (!jobRes.data) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const customerId = String(body.customer_id ?? jobRes.data.customer_id ?? '').trim()
  if (!uuid.test(customerId)) {
    return NextResponse.json({ error: 'Invalid customer_id' }, { status: 400 })
  }

  const requestedVersionState = asText(body.version_state).toLowerCase()
  const requestedVersionKind = asText(body.version_kind).toLowerCase()
  const versionState = VERSION_STATES.has(requestedVersionState) ? requestedVersionState : 'draft'
  const versionKind = VERSION_KINDS.has(requestedVersionKind) ? requestedVersionKind : 'standard'

  const latestSortRes = await supabaseAdmin
    .from('estimates')
    .select('version_sort_order')
    .eq('org_id', orgId)
    .eq('job_id', jobId)
    .order('version_sort_order', { ascending: false })
    .limit(1)

  if (latestSortRes.error) {
    return NextResponse.json({ error: latestSortRes.error.message }, { status: 500 })
  }

  const existingSort = asOptionalNumber(latestSortRes.data?.[0]?.version_sort_order)
  const requestedSortOrder = asOptionalNumber(body.version_sort_order)
  const versionSortOrder =
    requestedSortOrder != null ? Math.max(0, Math.trunc(requestedSortOrder)) : (existingSort ?? -1) + 1
  const fallbackVersionName = `Estimate Version ${versionSortOrder + 1}`
  const versionName = asText(body.version_name) || fallbackVersionName

  const createRes = await supabaseAdmin
    .from('estimates')
    .insert({
      org_id: orgId,
      job_id: jobId,
      customer_id: customerId,
      status: 'draft',
      version_name: versionName,
      version_state: versionState,
      version_kind: versionKind,
      version_sort_order: versionSortOrder,
      created_by: userId,
    })
    .select(
      'id, job_id, customer_id, status, version_name, version_state, version_kind, version_sort_order, created_at, updated_at'
    )
    .single()

  if (createRes.error) {
    return NextResponse.json({ error: createRes.error.message }, { status: 500 })
  }

  const estimateId = createRes.data.id
  const settingsInsert = await supabaseAdmin.from('estimate_jobsettings').insert({
    org_id: orgId,
    estimate_id: estimateId,
    job_id: jobId,
  })
  if (settingsInsert.error) {
    await supabaseAdmin.from('estimates').delete().eq('org_id', orgId).eq('id', estimateId)
    return NextResponse.json({ error: settingsInsert.error.message }, { status: 500 })
  }

  const pricingPolicyInsert = await supabaseAdmin.from('estimate_pricing_policies').insert({
    org_id: orgId,
    estimate_id: estimateId,
    job_id: jobId,
  })
  if (pricingPolicyInsert.error) {
    await supabaseAdmin.from('estimate_jobsettings').delete().eq('org_id', orgId).eq('estimate_id', estimateId)
    await supabaseAdmin.from('estimates').delete().eq('org_id', orgId).eq('id', estimateId)
    return NextResponse.json({ error: pricingPolicyInsert.error.message }, { status: 500 })
  }

  const snapshotInsert = await createEstimateRatesFlagsCatalogSnapshot({
    orgId,
    estimateId,
  })
  if (!snapshotInsert.ok) {
    await supabaseAdmin.from('estimate_pricing_policies').delete().eq('org_id', orgId).eq('estimate_id', estimateId)
    await supabaseAdmin.from('estimate_jobsettings').delete().eq('org_id', orgId).eq('estimate_id', estimateId)
    await supabaseAdmin.from('estimates').delete().eq('org_id', orgId).eq('id', estimateId)
    return NextResponse.json({ error: snapshotInsert.error }, { status: snapshotInsert.status })
  }

  return NextResponse.json({
    ok: true,
    id: estimateId,
    estimate: createRes.data,
  })
}

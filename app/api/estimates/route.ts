import { NextResponse } from 'next/server'
import { createEstimateWorkbook } from '@/lib/server/estimateSpreadsheet'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseSpreadsheetIdFromSheetPath(path: string | null | undefined) {
  const raw = String(path ?? '').trim()
  if (!raw) return null
  const filePathMatch = /sheet_([a-zA-Z0-9\-_]+)\.xlsx/.exec(raw)
  if (filePathMatch?.[1]) return filePathMatch[1]
  const urlMatch = /\/spreadsheets\/d\/([a-zA-Z0-9\-_]+)/.exec(raw)
  if (urlMatch?.[1]) return urlMatch[1]
  return null
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
    .select('id, job_id, customer_id, status, sheet_schema_version, sheet_file_path, latest_output_json, created_at, updated_at')
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
      is_sent_estimate: Boolean(jobs.get(row.job_id)?.estimate_sent_at),
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

  const createRes = await supabaseAdmin
    .from('estimates')
    .insert({
      org_id: orgId,
      job_id: jobId,
      customer_id: customerId,
      status: 'draft',
      created_by: userId,
    })
    .select('id, job_id')
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
    return NextResponse.json({ error: settingsInsert.error.message }, { status: 500 })
  }

  try {
    const origin = new URL(request.url).origin
    const workbook = await createEstimateWorkbook({
      origin,
      orgId,
      userId,
      estimateId,
      jobId,
    })
    const update = await supabaseAdmin
      .from('estimates')
      .update({
        sheet_schema_version: workbook.schemaVersion,
        sheet_file_path: workbook.sheetFilePath,
      })
      .eq('org_id', orgId)
      .eq('id', estimateId)
    if (update.error) {
      return NextResponse.json({ error: update.error.message }, { status: 500 })
    }

    const workbookSpreadsheetId = parseSpreadsheetIdFromSheetPath(workbook.sheetFilePath)
    const siblingRes = await supabaseAdmin
      .from('estimates')
      .select('id, sheet_file_path')
      .eq('org_id', orgId)
      .eq('job_id', jobId)
      .neq('id', estimateId)
      .not('sheet_file_path', 'is', null)
    if (siblingRes.error) {
      return NextResponse.json({ error: siblingRes.error.message }, { status: 500 })
    }
    const duplicate = (siblingRes.data ?? []).find((row) => {
      const siblingPath =
        typeof row.sheet_file_path === 'string' ? row.sheet_file_path : null
      if (!siblingPath) return false
      if (siblingPath === workbook.sheetFilePath) return true
      const siblingSpreadsheetId = parseSpreadsheetIdFromSheetPath(siblingPath)
      return Boolean(
        workbookSpreadsheetId &&
          siblingSpreadsheetId &&
          workbookSpreadsheetId === siblingSpreadsheetId
      )
    })
    if (duplicate) {
      throw new Error(
        `Workbook isolation check failed: estimate ${duplicate.id} already references the same sheet.`
      )
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed creating estimate workbook'
    await supabaseAdmin
      .from('estimates')
      .update({ status: 'error' })
      .eq('org_id', orgId)
      .eq('id', estimateId)
    return NextResponse.json({ error: message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, id: estimateId })
}

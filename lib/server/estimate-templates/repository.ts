import type {
  EstimateJobTemplateData,
  EstimateRoomTemplateData,
  EstimateTemplateData,
  EstimateTemplateListPayload,
  EstimateTemplateMutationPayload,
  EstimateTemplateRecord,
  EstimateTemplateStatus,
} from '@/lib/estimator/v2Templates'
import { supabaseAdmin } from '../org.ts'
import { errorResult, okResult, type ServiceResult } from '../serviceResult.ts'

type TemplateTableName = 'estimator_room_templates' | 'estimator_job_templates'

type TemplateQueryError = {
  message: string
}

type TemplateQuery = {
  select(columns?: string): TemplateQuery
  eq(column: string, value: string): TemplateQuery
  order(column: string, options: { ascending: boolean }): Promise<TemplateRowsResult>
  insert(rows: Record<string, unknown>[]): TemplateQuery
  update(updates: Record<string, unknown>): TemplateQuery
  single(): Promise<TemplateRowResult>
  maybeSingle(): Promise<TemplateRowResult>
}

type TemplateRowsResult = {
  data: EstimateTemplateRecord[] | null
  error: TemplateQueryError | null
}

type TemplateRowResult = {
  data: EstimateTemplateRecord | null
  error: TemplateQueryError | null
}

export type EstimateTemplateRepositoryDeps = {
  client: {
    from: (relation: string) => unknown
  }
}

const defaultDeps: EstimateTemplateRepositoryDeps = {
  client: supabaseAdmin,
}

function withDeps(
  overrides?: Partial<EstimateTemplateRepositoryDeps>
): EstimateTemplateRepositoryDeps {
  return {
    ...defaultDeps,
    ...overrides,
  }
}

function tableForKind(kind: 'room' | 'job'): TemplateTableName {
  return kind === 'room' ? 'estimator_room_templates' : 'estimator_job_templates'
}

function missingTableMessage(kind: 'room' | 'job') {
  const table = tableForKind(kind)
  return `${table} is missing. Run supabase/sql/096_estimator_v2_room_job_templates.sql and reload the schema cache.`
}

function normalizeQueryError(kind: 'room' | 'job', error: TemplateQueryError) {
  if (error.message.includes(tableForKind(kind))) {
    return missingTableMessage(kind)
  }
  return error.message
}

export async function listEstimateTemplateRecords(
  orgId: string,
  params: { status?: EstimateTemplateStatus | 'all'; kind?: 'room' | 'job' | 'all' },
  deps: Partial<EstimateTemplateRepositoryDeps> = {}
): Promise<ServiceResult<EstimateTemplateListPayload>> {
  const { client } = withDeps(deps)
  const kinds = params.kind && params.kind !== 'all' ? [params.kind] : (['room', 'job'] as const)
  const payload: EstimateTemplateListPayload = {
    room_templates: [],
    job_templates: [],
  }

  try {
    for (const kind of kinds) {
      let query = (client.from(tableForKind(kind)) as TemplateQuery)
        .select('*')
        .eq('org_id', orgId)
      if (params.status && params.status !== 'all') {
        query = query.eq('status', params.status)
      }
      const { data, error } = await query.order('name', { ascending: true })
      if (error) return errorResult('server_error', normalizeQueryError(kind, error))
      if (kind === 'room') {
        payload.room_templates = (data ?? []) as EstimateTemplateRecord<EstimateRoomTemplateData>[]
      } else {
        payload.job_templates = (data ?? []) as EstimateTemplateRecord<EstimateJobTemplateData>[]
      }
    }

    return okResult(payload)
  } catch (error) {
    return errorResult(
      'server_error',
      error instanceof Error ? error.message : 'Failed to load estimator templates'
    )
  }
}

export async function loadEstimateTemplateRecord(
  orgId: string,
  kind: 'room' | 'job',
  templateId: string,
  deps: Partial<EstimateTemplateRepositoryDeps> = {}
): Promise<ServiceResult<EstimateTemplateRecord>> {
  const { client } = withDeps(deps)

  try {
    const { data, error } = await ((client.from(tableForKind(kind)) as TemplateQuery)
      .select('*')
      .eq('org_id', orgId)
      .eq('id', templateId)
      .maybeSingle() as Promise<TemplateRowResult>)
    if (error) return errorResult('server_error', normalizeQueryError(kind, error))
    if (!data) return errorResult('not_found', 'Template not found')
    return okResult(data)
  } catch (error) {
    return errorResult(
      'server_error',
      error instanceof Error ? error.message : 'Failed to load estimator template'
    )
  }
}

export async function createEstimateTemplateRecord(
  orgId: string,
  userId: string,
  payload: EstimateTemplateMutationPayload,
  deps: Partial<EstimateTemplateRepositoryDeps> = {}
): Promise<ServiceResult<EstimateTemplateRecord>> {
  const { client } = withDeps(deps)

  try {
    const { data, error } = await ((client.from(tableForKind(payload.kind)) as TemplateQuery)
      .insert([
        {
          org_id: orgId,
          name: payload.name,
          description: payload.description,
          status: payload.status,
          template_data: payload.template_data,
          snapshot_labels: payload.snapshot_labels,
          source_estimate_id: payload.source_estimate_id,
          created_by: userId,
          updated_by: userId,
        },
      ])
      .select()
      .single() as Promise<TemplateRowResult>)
    if (error) return errorResult('invalid_input', normalizeQueryError(payload.kind, error))
    if (!data) return errorResult('server_error', 'Template was not created')
    return okResult(data)
  } catch (error) {
    return errorResult(
      'server_error',
      error instanceof Error ? error.message : 'Failed to create estimator template'
    )
  }
}

export async function updateEstimateTemplateRecord(
  orgId: string,
  userId: string,
  templateId: string,
  payload: EstimateTemplateMutationPayload,
  deps: Partial<EstimateTemplateRepositoryDeps> = {}
): Promise<ServiceResult<EstimateTemplateRecord<EstimateTemplateData>>> {
  const { client } = withDeps(deps)

  try {
    const { data, error } = await ((client.from(tableForKind(payload.kind)) as TemplateQuery)
      .update({
        name: payload.name,
        description: payload.description,
        status: payload.status,
        template_data: payload.template_data,
        snapshot_labels: payload.snapshot_labels,
        source_estimate_id: payload.source_estimate_id,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', orgId)
      .eq('id', templateId)
      .select()
      .single() as Promise<TemplateRowResult>)
    if (error) return errorResult('invalid_input', normalizeQueryError(payload.kind, error))
    if (!data) return errorResult('not_found', 'Template not found')
    return okResult(data)
  } catch (error) {
    return errorResult(
      'server_error',
      error instanceof Error ? error.message : 'Failed to update estimator template'
    )
  }
}

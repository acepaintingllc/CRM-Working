import {
  normalizeEstimateTemplateMutationBody,
  type EstimateTemplateKind,
  type EstimateTemplateListPayload,
  type EstimateTemplateRecord,
  type EstimateTemplateStatus,
} from '@/lib/estimator/v2Templates'
import { errorResult, type ServiceResult } from '../serviceResult.ts'
import {
  createEstimateTemplateRecord,
  listEstimateTemplateRecords,
  loadEstimateTemplateRecord,
  updateEstimateTemplateRecord,
  type EstimateTemplateRepositoryDeps,
} from './repository.ts'

type EstimateTemplateServiceDeps = Partial<EstimateTemplateRepositoryDeps>

export function parseEstimateTemplateKind(value: string | null): EstimateTemplateKind | 'all' {
  if (value === 'room' || value === 'job') return value
  return 'all'
}

export function parseEstimateTemplateStatus(value: string | null): EstimateTemplateStatus | 'all' {
  if (value === 'active' || value === 'archived') return value
  if (value === 'all') return 'all'
  return 'active'
}

export async function listEstimateTemplates(
  orgId: string,
  searchParams: URLSearchParams,
  deps: EstimateTemplateServiceDeps = {}
): Promise<ServiceResult<EstimateTemplateListPayload>> {
  return listEstimateTemplateRecords(
    orgId,
    {
      kind: parseEstimateTemplateKind(searchParams.get('kind')),
      status: parseEstimateTemplateStatus(searchParams.get('status')),
    },
    deps
  )
}

export async function createEstimateTemplate(
  orgId: string,
  userId: string,
  body: unknown,
  deps: EstimateTemplateServiceDeps = {}
): Promise<ServiceResult<EstimateTemplateRecord>> {
  const validated = normalizeEstimateTemplateMutationBody(body)
  if (!validated.ok) return errorResult('invalid_input', validated.message)
  return createEstimateTemplateRecord(orgId, userId, validated.payload, deps)
}

export async function updateEstimateTemplate(
  orgId: string,
  userId: string,
  templateId: string,
  body: unknown,
  deps: EstimateTemplateServiceDeps = {}
): Promise<ServiceResult<EstimateTemplateRecord>> {
  const kind = parseEstimateTemplateKind(
    body && typeof body === 'object' && 'kind' in body ? String(body.kind) : null
  )
  if (kind === 'all') return errorResult('invalid_input', 'Template kind must be room or job.')

  const existing = await loadEstimateTemplateRecord(orgId, kind, templateId, deps)
  if (!existing.ok) return existing

  const validated = normalizeEstimateTemplateMutationBody(body, existing.data)
  if (!validated.ok) return errorResult('invalid_input', validated.message)
  if (validated.payload.kind !== kind) {
    return errorResult('invalid_input', 'Template kind cannot be changed.')
  }
  return updateEstimateTemplateRecord(orgId, userId, templateId, validated.payload, deps)
}

'use client'

import { loadData, mutateData } from '@/lib/client/api'
import type {
  EstimateTemplateKind,
  EstimateTemplateListPayload,
  EstimateTemplateMutationPayload,
  EstimateTemplateRecord,
  EstimateTemplateStatus,
} from '@/lib/estimator/v2Templates'

const TEMPLATES_ENDPOINT = '/api/estimates/v2/templates'

export type EstimateTemplateListFilters = {
  kind?: EstimateTemplateKind | 'all'
  status?: EstimateTemplateStatus | 'all'
}

function buildTemplateQuery(filters: EstimateTemplateListFilters = {}) {
  const params = new URLSearchParams()
  if (filters.kind) params.set('kind', filters.kind)
  if (filters.status) params.set('status', filters.status)
  const query = params.toString()
  return query ? `${TEMPLATES_ENDPOINT}?${query}` : TEMPLATES_ENDPOINT
}

export function loadEstimateTemplates(filters?: EstimateTemplateListFilters) {
  return loadData<EstimateTemplateListPayload>(buildTemplateQuery(filters), { cache: 'no-store' })
}

export function createEstimateTemplate(payload: EstimateTemplateMutationPayload) {
  return mutateData<EstimateTemplateRecord>(TEMPLATES_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function updateEstimateTemplate(templateId: string, payload: EstimateTemplateMutationPayload) {
  return mutateData<EstimateTemplateRecord>(`${TEMPLATES_ENDPOINT}/${templateId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

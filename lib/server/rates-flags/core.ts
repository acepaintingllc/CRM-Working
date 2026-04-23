import type {
  RatesFlagsCreateOrUpdateMutationRequest,
  RatesFlagsMutationRequest,
  RatesFlagsPayload,
} from '../../../types/estimator/ratesFlags'
import { CATEGORY_CONFIGS, getCategoryConfig } from './categories.ts'
import { buildCategory, buildCategoryFromStoredRows, buildMutationPlan } from './categoryHelpers.ts'
import { parseRatesFlagsMutationRequest } from './mutationParser.ts'
import { type RatesFlagsCatalogOverlay, isAreaBasedUnit } from './shared.ts'
import { buildOverlayFromRows } from './overlay.ts'
import { findCategoryTablesDetailed, findTableDetailed, getHeaderIndex, parseConstantsTablesDetailed, parseSchemaVersion } from './tableParsing.ts'
import { bumpTemplateVersion, ensureTemplateState, fetchTemplateState, getSupabaseAdmin, getTemplateRowById, setSupabaseAdminProvider } from './templateState.ts'
import { asText, normalizeId, toYN } from './shared.ts'

export { parseConstantsTablesDetailed, type RatesFlagsCatalogOverlay }
export { parseRatesFlagsMutationRequest }

export async function readRatesFlagsPayload(params: {
  origin: string
  orgId: string
  userId: string
}): Promise<RatesFlagsPayload> {
  void params.origin
  void params.userId
  const state = await ensureTemplateState(params.orgId)
  const rowsByCategory = new Map<
    (typeof CATEGORY_CONFIGS)[number]['key'],
    Parameters<typeof buildCategoryFromStoredRows>[1]
  >()
  for (const config of CATEGORY_CONFIGS) rowsByCategory.set(config.key, [])
  for (const row of state.rows) {
    const arr = rowsByCategory.get(row.category_key)
    if (arr) arr.push(row)
  }
  const categories = CATEGORY_CONFIGS.map((config) =>
    buildCategoryFromStoredRows(config, rowsByCategory.get(config.key) ?? [])
  )
  return {
    source: 'db',
    seeded: true,
    template_version: state.template?.version ?? null,
    categories,
  }
}

export function buildRatesFlagsPayloadFromValues(
  values: string[][],
  spreadsheetId: string
): RatesFlagsPayload {
  void spreadsheetId
  const tables = parseConstantsTablesDetailed(values)
  const categories = CATEGORY_CONFIGS.map((config) => {
    const categoryTables = findCategoryTablesDetailed(tables, config)
    return buildCategory(config, categoryTables)
  })
  return {
    source: 'sheet',
    seeded: true,
    template_version: null,
    schema_version: parseSchemaVersion(values),
    categories,
  }
}

export async function applyRatesFlagsMutation(params: {
  origin: string
  orgId: string
  userId: string
  request: RatesFlagsMutationRequest
}) {
  void params.origin
  void params.userId
  const supabaseAdmin = await getSupabaseAdmin()
  const config = getCategoryConfig(params.request.category)
  if (!config) {
    return { ok: false as const, error: 'Unknown category.', status: 400 }
  }
  const state = await ensureTemplateState(params.orgId)
  const template = state.template
  if (!template) {
    return { ok: false as const, error: 'Template initialization failed.', status: 500 }
  }

  try {
    if (params.request.action === 'archive' || params.request.action === 'reactivate') {
      const existing = await getTemplateRowById({
        orgId: params.orgId,
        templateId: template.id,
        categoryKey: config.key,
        rowId: params.request.rowId,
      })
      if (!existing) return { ok: false as const, error: 'Row not found.', status: 404 }
      const update = await supabaseAdmin
        .from('estimator_template_constant_rows')
        .update({
          active: params.request.action === 'archive' ? 'N' : 'Y',
        })
        .eq('id', existing.id)
      if (update.error) throw new Error(update.error.message)
      await bumpTemplateVersion(params.orgId, template)
      return { ok: true as const }
    }
    const mutation: RatesFlagsCreateOrUpdateMutationRequest = params.request
    const originalId = normalizeId(
      mutation.action === 'update' ? mutation.original_id : mutation.values.id
    ) || normalizeId(mutation.values.id)
    if (!originalId) {
      return { ok: false as const, error: 'Missing row id.', status: 400 }
    }
    const nextId = normalizeId(mutation.values.id)
    const nextDisplayName =
      asText(mutation.values.display_name) || asText(mutation.values.id)
    const nextActive = toYN(
      mutation.values.active,
      mutation.action === 'create' ? 'Y' : 'N'
    ) as 'Y' | 'N'
    const { active, ...valuesJson } = mutation.values
    void active

    if (mutation.action === 'create') {
      const collision = await getTemplateRowById({
        orgId: params.orgId,
        templateId: template.id,
        categoryKey: config.key,
        rowId: nextId,
      })
      if (collision) {
        return { ok: false as const, error: `Row '${nextId}' already exists.`, status: 409 }
      }

      const sortRes = await supabaseAdmin
        .from('estimator_template_constant_rows')
        .select('sort_order')
        .eq('org_id', params.orgId)
        .eq('template_id', template.id)
        .eq('category_key', config.key)
        .order('sort_order', { ascending: false })
        .limit(1)
      if (sortRes.error) throw new Error(sortRes.error.message)
      const nextSort = (sortRes.data?.[0]?.sort_order ?? -1) + 1

      const insert = await supabaseAdmin.from('estimator_template_constant_rows').insert({
        org_id: params.orgId,
        template_id: template.id,
        category_key: config.key,
        row_id: nextId,
        display_name: nextDisplayName,
        active: nextActive,
        sort_order: nextSort,
        values_json: valuesJson,
      })
      if (insert.error) throw new Error(insert.error.message)

      await bumpTemplateVersion(params.orgId, template)
      return { ok: true as const }
    }

    if (mutation.action === 'update') {
      const existing = await getTemplateRowById({
        orgId: params.orgId,
        templateId: template.id,
        categoryKey: config.key,
        rowId: originalId,
      })
      if (!existing) return { ok: false as const, error: 'Row not found.', status: 404 }

      if (nextId !== originalId) {
        const collision = await getTemplateRowById({
          orgId: params.orgId,
          templateId: template.id,
          categoryKey: config.key,
          rowId: nextId,
        })
        if (collision) {
          return { ok: false as const, error: `Row '${nextId}' already exists.`, status: 409 }
        }
      }

      const update = await supabaseAdmin
        .from('estimator_template_constant_rows')
        .update({
          row_id: nextId,
          display_name: nextDisplayName,
          active: nextActive,
          values_json: valuesJson,
        })
        .eq('id', existing.id)
      if (update.error) throw new Error(update.error.message)

      await bumpTemplateVersion(params.orgId, template)
      return { ok: true as const }
    }
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Failed to apply mutation.',
      status: 400,
    }
  }

  return { ok: false as const, error: 'Unsupported mutation action.', status: 400 }
}

export async function readLiveRatesFlagsCatalogOverlay(params: { orgId: string }) {
  const state = await fetchTemplateState(params.orgId)
  if (!state.template) return null
  return buildOverlayFromRows({
    templateVersion: state.template.version,
    rows: state.rows,
  })
}

export async function getOrCreateLiveRatesFlagsCatalogOverlay(params: { orgId: string }) {
  const state = await ensureTemplateState(params.orgId)
  if (!state.template) throw new Error('Template initialization failed.')
  return buildOverlayFromRows({
    templateVersion: state.template.version,
    rows: state.rows,
  })
}

export const _test = {
  CATEGORY_CONFIGS,
  buildOverlayFromRows,
  buildMutationPlan,
  ensureTemplateState,
  findTableDetailed,
  getHeaderIndex,
  isAreaBasedUnit,
  parseRatesFlagsMutationRequest,
  setSupabaseAdminProvider,
}

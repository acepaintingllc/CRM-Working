import type {
  RatesFlagsCreateOrUpdateMutationRequest,
  RatesFlagsMutationRequest,
  RatesFlagsPayload,
} from '../../../types/estimator/ratesFlags'
import { CATEGORY_CONFIGS, getCategoryConfig } from './categories.ts'
import { buildCategory, buildCategoryFromStoredRows, buildMutationPlan } from './categoryHelpers.ts'
import {
  getRatesFlagsMutationParserCategoryKeys,
  getRatesFlagsMutationParserFieldKeys,
  getRatesFlagsMutationParserRequiredFieldKeys,
  parseRatesFlagsMutationRequest,
} from './mutationParser.ts'
import { type RatesFlagsCatalogOverlay, isAreaBasedUnit } from './shared.ts'
import { buildOverlayFromRows } from './overlay.ts'
import { findCategoryTablesDetailed, findTableDetailed, getHeaderIndex, parseConstantsTablesDetailed, parseSchemaVersion } from './tableParsing.ts'
import { ensureTemplateState, setSupabaseAdminProvider } from './templateState.ts'
import { asText, normalizeId, toYN } from './shared.ts'
import {
  activateDraftSettingSet,
  cloneActiveSettingSetAsDraft,
  loadActiveSettingSet,
  loadLatestDraftSettingSet,
  loadSettingSetById,
  settingSetMetadata,
  settingSetToTemplateRecord,
  settingValuesToTemplateRows,
  updateDraftSettingRowValue,
  type EstimatorSettingSetSnapshot,
} from '../estimate-feedback/settingSets.ts'

export { parseConstantsTablesDetailed, type RatesFlagsCatalogOverlay }
export { parseRatesFlagsMutationRequest }

export async function readRatesFlagsPayload(params: {
  origin: string
  orgId: string
  userId: string
}): Promise<RatesFlagsPayload> {
  void params.origin
  void params.userId
  const active = await loadActiveSettingSet({ orgId: params.orgId })
  const draft = await loadLatestDraftSettingSet({ orgId: params.orgId })
  const editing = draft ?? active
  if (!editing) {
    return {
      source: 'db',
      seeded: false,
      template_version: null,
      active_setting_set: null,
      draft_setting_set: null,
      editing_setting_set: null,
      categories: CATEGORY_CONFIGS.map((config) => buildCategoryFromStoredRows(config, [])),
      condition_modifier_catalog: [],
    }
  }

  const rows = settingValuesToTemplateRows(editing)
  const template = settingSetToTemplateRecord(editing)
  const rowsByCategory = new Map<
    (typeof CATEGORY_CONFIGS)[number]['key'],
    Parameters<typeof buildCategoryFromStoredRows>[1]
  >()
  for (const config of CATEGORY_CONFIGS) rowsByCategory.set(config.key, [])
  for (const row of rows) {
    const arr = rowsByCategory.get(row.category_key)
    if (arr) arr.push(row)
  }
  const categories = CATEGORY_CONFIGS.map((config) =>
    buildCategoryFromStoredRows(config, rowsByCategory.get(config.key) ?? [])
  )
  const overlay = buildOverlayFromRows({
    templateVersion: template.version,
    rows,
  })
  return {
    source: 'db',
    seeded: true,
    template_version: template.version,
    active_setting_set: settingSetMetadata(active),
    draft_setting_set: settingSetMetadata(draft),
    editing_setting_set: settingSetMetadata(editing),
    categories,
    condition_modifier_catalog: overlay.condition_modifiers,
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
    active_setting_set: null,
    draft_setting_set: null,
    editing_setting_set: null,
    categories,
  }
}

async function getOrCreateRatesFlagsDraft(params: {
  orgId: string
  userId: string
}): Promise<EstimatorSettingSetSnapshot> {
  const existingDraft = await loadLatestDraftSettingSet({ orgId: params.orgId })
  if (existingDraft) return existingDraft
  const draft = await cloneActiveSettingSetAsDraft({
    orgId: params.orgId,
    userId: params.userId,
    notes: 'Rates/Flags draft',
  })
  if (!draft) throw new Error('Failed to create rates and flags draft.')
  return draft
}

function getDraftRowValueJson(values: Record<string, unknown>) {
  const { active, ...valuesJson } = values
  void active
  return valuesJson
}

export async function applyRatesFlagsMutation(params: {
  origin: string
  orgId: string
  userId: string
  request: RatesFlagsMutationRequest
}) {
  void params.origin
  const config = getCategoryConfig(params.request.category)
  if (!config) {
    return { ok: false as const, error: 'Unknown category.', status: 400 }
  }

  try {
    const draft = await getOrCreateRatesFlagsDraft({
      orgId: params.orgId,
      userId: params.userId,
    })
    const request = params.request
    if (request.action === 'archive' || request.action === 'reactivate') {
      const existing = draft.values.find(
        (value) => value.category_key === config.key && value.row_id === request.rowId
      )
      if (!existing) return { ok: false as const, error: 'Row not found.', status: 404 }
      await updateDraftSettingRowValue({
        orgId: params.orgId,
        settingSetId: draft.set.id,
        categoryKey: config.key,
        originalRowId: request.rowId,
        rowId: request.rowId,
        displayName: existing.display_name,
        active: request.action === 'reactivate',
        sortOrder: existing.sort_order,
        valueJson: existing.value_json ?? {},
      })
      return { ok: true as const }
    }
    const mutation = request as RatesFlagsCreateOrUpdateMutationRequest
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
    const valuesJson = getDraftRowValueJson(mutation.values)

    if (mutation.action === 'create') {
      const collision = draft.values.find(
        (value) => value.category_key === config.key && value.row_id === nextId
      )
      if (collision) {
        return { ok: false as const, error: `Row '${nextId}' already exists.`, status: 409 }
      }

      await updateDraftSettingRowValue({
        orgId: params.orgId,
        settingSetId: draft.set.id,
        categoryKey: config.key,
        rowId: nextId,
        displayName: nextDisplayName,
        active: nextActive === 'Y',
        valueJson: valuesJson,
      })
      return { ok: true as const }
    }

    if (mutation.action === 'update') {
      const existing = draft.values.find(
        (value) => value.category_key === config.key && value.row_id === originalId
      )
      if (!existing) return { ok: false as const, error: 'Row not found.', status: 404 }

      if (nextId !== originalId) {
        const collision = draft.values.find(
          (value) => value.category_key === config.key && value.row_id === nextId
        )
        if (collision) {
          return { ok: false as const, error: `Row '${nextId}' already exists.`, status: 409 }
        }
      }

      await updateDraftSettingRowValue({
        orgId: params.orgId,
        settingSetId: draft.set.id,
        categoryKey: config.key,
        originalRowId: originalId,
        rowId: nextId,
        displayName: nextDisplayName,
        active: nextActive === 'Y',
        sortOrder: existing.sort_order,
        valueJson: valuesJson,
      })
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

export async function activateRatesFlagsDraft(params: {
  origin: string
  orgId: string
  userId: string
  settingSetId?: string | null
  reason?: string
}) {
  void params.origin
  const draft = params.settingSetId
    ? await loadSettingSetById({
        orgId: params.orgId,
        settingSetId: params.settingSetId,
      })
    : await loadLatestDraftSettingSet({ orgId: params.orgId })
  if (!draft) {
    return { ok: false as const, error: 'No draft setting set to activate.', status: 404 }
  }
  try {
    await activateDraftSettingSet({
      orgId: params.orgId,
      settingSetId: draft.set.id,
      userId: params.userId,
      reason: params.reason ?? 'Rates/Flags draft activated',
      source: 'rates_flags_admin',
    })
    return { ok: true as const }
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Failed to activate draft.',
      status: 400,
    }
  }
}

export async function readLiveRatesFlagsCatalogOverlay(params: { orgId: string }) {
  const active = await loadActiveSettingSet({ orgId: params.orgId })
  if (!active) return null
  const rows = settingValuesToTemplateRows(active)
  const template = settingSetToTemplateRecord(active)
  return buildOverlayFromRows({
    templateVersion: template.version,
    rows,
  })
}

export async function getOrCreateLiveRatesFlagsCatalogOverlay(params: { orgId: string }) {
  const active = await loadActiveSettingSet({ orgId: params.orgId })
  if (!active) throw new Error('No active estimator setting set found.')
  const rows = settingValuesToTemplateRows(active)
  const template = settingSetToTemplateRecord(active)
  return buildOverlayFromRows({
    templateVersion: template.version,
    rows,
  })
}

export const _test = {
  CATEGORY_CONFIGS,
  buildOverlayFromRows,
  buildMutationPlan,
  ensureTemplateState,
  findTableDetailed,
  getHeaderIndex,
  getRatesFlagsMutationParserCategoryKeys,
  getRatesFlagsMutationParserFieldKeys,
  getRatesFlagsMutationParserRequiredFieldKeys,
  isAreaBasedUnit,
  parseRatesFlagsMutationRequest,
  setSupabaseAdminProvider,
}

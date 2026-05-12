import type {
  RatesFlagsBatchPublishResult,
  RatesFlagsMutationRequest,
  RatesFlagsPayload,
} from '../../../types/estimator/ratesFlags'
import { CATEGORY_CONFIGS } from './categories.ts'
import { buildCategory, buildCategoryFromStoredRows, buildMutationPlan } from './categoryHelpers.ts'
import {
  getRatesFlagsMutationParserCategoryKeys,
  getRatesFlagsMutationParserFieldKeys,
  getRatesFlagsMutationParserRequiredFieldKeys,
  parseRatesFlagsBatchPublishRequest,
  parseRatesFlagsMutationRequest,
} from './mutationParser.ts'
import { type RatesFlagsCatalogOverlay, isAreaBasedUnit } from './shared.ts'
import { buildOverlayFromRows } from './overlay.ts'
import { findCategoryTablesDetailed, findTableDetailed, getHeaderIndex, parseConstantsTablesDetailed, parseSchemaVersion } from './tableParsing.ts'
import { ensureTemplateState, setSupabaseAdminProvider } from './templateState.ts'
import { normalizeId } from './shared.ts'
import {
  loadActiveSettingSet,
  publishRatesFlagsSettingSetBatch,
  settingSetMetadata,
  settingSetToTemplateRecord,
  settingValuesToTemplateRows,
  _test as settingSetsTest,
  type EstimatorSettingSetSnapshot,
} from '../estimate-feedback/settingSets.ts'

export { parseConstantsTablesDetailed, type RatesFlagsCatalogOverlay }
export { parseRatesFlagsBatchPublishRequest, parseRatesFlagsMutationRequest }

function buildRatesFlagsPayloadFromSettingSetSnapshots(params: {
  active: EstimatorSettingSetSnapshot | null
  draft: EstimatorSettingSetSnapshot | null
  editing: EstimatorSettingSetSnapshot | null
}): RatesFlagsPayload {
  const editing = params.editing
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
    active_setting_set: settingSetMetadata(params.active),
    draft_setting_set: settingSetMetadata(params.draft),
    editing_setting_set: settingSetMetadata(editing),
    categories,
    condition_modifier_catalog: overlay.condition_modifiers,
  }
}

export async function readRatesFlagsPayload(params: {
  origin: string
  orgId: string
  userId: string
}): Promise<RatesFlagsPayload> {
  void params.origin
  void params.userId
  const active = await loadActiveSettingSet({ orgId: params.orgId })
  return buildRatesFlagsPayloadFromSettingSetSnapshots({
    active,
    draft: null,
    editing: active,
  })
}

async function readActiveRatesFlagsPayload(params: {
  orgId: string
}): Promise<RatesFlagsPayload> {
  const active = await loadActiveSettingSet({ orgId: params.orgId })
  return buildRatesFlagsPayloadFromSettingSetSnapshots({
    active,
    draft: null,
    editing: active,
  })
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

function validateRatesFlagsBatchAgainstSnapshot(params: {
  active: EstimatorSettingSetSnapshot
  mutations: RatesFlagsMutationRequest[]
}) {
  const rowIdsByCategory = new Map<string, Set<string>>()
  for (const value of params.active.values) {
    if (!value.row_id) continue
    const set = rowIdsByCategory.get(value.category_key) ?? new Set<string>()
    set.add(value.row_id)
    rowIdsByCategory.set(value.category_key, set)
  }

  for (const mutation of params.mutations) {
    const categoryRows = rowIdsByCategory.get(mutation.category) ?? new Set<string>()
    rowIdsByCategory.set(mutation.category, categoryRows)

    if (mutation.action === 'archive' || mutation.action === 'reactivate') {
      if (!categoryRows.has(mutation.rowId)) {
        return { ok: false as const, error: 'Row not found.', status: 404 }
      }
      continue
    }

    const originalId = normalizeId(
      mutation.action === 'update' ? mutation.original_id : mutation.values.id
    ) || normalizeId(mutation.values.id)
    const nextId = normalizeId(mutation.values.id)
    if (!originalId || !nextId) {
      return { ok: false as const, error: 'Missing row id.', status: 400 }
    }

    if (mutation.action === 'create') {
      if (categoryRows.has(nextId)) {
        return { ok: false as const, error: `Row '${nextId}' already exists.`, status: 409 }
      }
      categoryRows.add(nextId)
      continue
    }

    if (!categoryRows.has(originalId)) {
      return { ok: false as const, error: 'Row not found.', status: 404 }
    }
    if (nextId !== originalId && categoryRows.has(nextId)) {
      return { ok: false as const, error: `Row '${nextId}' already exists.`, status: 409 }
    }
    categoryRows.delete(originalId)
    categoryRows.add(nextId)
  }

  return { ok: true as const }
}

export async function publishRatesFlagsBatch(params: {
  origin: string
  orgId: string
  userId: string
  mutations: RatesFlagsMutationRequest[]
  reason?: string
}): Promise<
  | { ok: true; data: RatesFlagsBatchPublishResult }
  | { ok: false; error: string; status: number }
> {
  void params.origin
  try {
    const active = await loadActiveSettingSet({ orgId: params.orgId })
    if (!active) {
      return { ok: false, error: 'No active estimator setting set found.', status: 404 }
    }

    const validation = validateRatesFlagsBatchAgainstSnapshot({
      active,
      mutations: params.mutations,
    })
    if (!validation.ok) return validation

    const published = await publishRatesFlagsSettingSetBatch({
      orgId: params.orgId,
      userId: params.userId,
      mutations: params.mutations,
      reason: params.reason ?? 'Rates/Flags batch published',
      source: 'rates_flags_batch_publish',
    })
    const activePayload = await readActiveRatesFlagsPayload({ orgId: params.orgId })
    const settingSet = published.settingSet

    return {
      ok: true,
      data: {
        payload: activePayload,
        setting_set_id:
          settingSet?.set.id ?? activePayload.active_setting_set?.id ?? active.set.id,
        version_number:
          settingSet?.set.version_number ??
          activePayload.active_setting_set?.version_number ??
          active.set.version_number,
        draft_estimates_updated: published.draftEstimatesUpdated,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to publish rates and flags.'
    const status = /already exists|unique/i.test(message)
      ? 409
      : /not found|No active estimator setting set/i.test(message)
        ? 404
        : 400
    return {
      ok: false,
      error: message,
      status,
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
  setSettingSetsSupabaseAdminProvider: settingSetsTest.setSettingSetsSupabaseAdminProvider,
  setSupabaseAdminProvider,
}

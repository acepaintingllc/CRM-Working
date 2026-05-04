import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const cwd = process.cwd()

function loadEnvFile(fileName) {
  const filePath = path.join(cwd, fileName)
  if (!existsSync(filePath)) return

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const equalsAt = trimmed.indexOf('=')
    if (equalsAt === -1) continue

    const key = trimmed.slice(0, equalsAt).trim()
    let value = trimmed.slice(equalsAt + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] ??= value
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const args = new Set(process.argv.slice(2))

function getArgValue(name) {
  const prefix = `${name}=`
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix))
  return match ? match.slice(prefix.length) : null
}

function output(message = '') {
  process.stdout.write(`${message}\n`)
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (args.has('--help') || args.has('-h')) {
  output(`
Seed estimator products and settings from one org into another.

Usage:
  npm run seed:estimator-org -- --source-org-id=<uuid>
  npm run seed:estimator-org -- --source-org-id=<uuid> --target-org-id=<uuid>
  npm run seed:estimator-org -- --source-org-id=<uuid> --dry-run

Defaults:
  --target-org-id defaults to CODEX_BROWSER_TEST_ORG_ID from .env.local
  --source-org-id is auto-discovered when there is exactly one non-target org with
  an active estimator setting set.

What it copies:
  - v2_products (remapped to target-safe ids when needed)
  - active estimator_setting_set and estimator_setting_value rows
  - estimate_template_settings compatibility mirror
  - estimator_template_constants and estimator_template_constant_rows compatibility mirror
`)
  process.exit(0)
}

const dryRun = args.has('--dry-run')
const sourceOrgIdArg = getArgValue('--source-org-id')
const targetOrgId =
  getArgValue('--target-org-id') || process.env.CODEX_BROWSER_TEST_ORG_ID?.trim() || null

if (!targetOrgId) {
  fail('Missing --target-org-id and CODEX_BROWSER_TEST_ORG_ID is not set.')
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  fail('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.')
}

if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
  fail('Refusing to run estimator org seed while NODE_ENV or VERCEL_ENV is production.')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const sourceOrgId = sourceOrgIdArg || (await discoverSourceOrgId(supabase, targetOrgId))
if (!sourceOrgId) {
  fail('Could not determine a source org. Pass --source-org-id=<uuid>.')
}

if (sourceOrgId === targetOrgId) {
  fail('Source and target org ids must be different.')
}

const sourceActiveSet = await loadActiveSettingSetSnapshot(supabase, sourceOrgId)
if (!sourceActiveSet) {
  fail(`No active estimator setting set found in source org ${sourceOrgId}.`)
}

const sourceProducts = await loadAllProducts(supabase, sourceOrgId)
const sourceTemplateSettings = await loadTemplateSettings(supabase, sourceOrgId)
const sourceTemplateConstants = await loadTemplateConstants(supabase, sourceOrgId)
const sourceTemplateRows = sourceTemplateConstants
  ? await loadTemplateConstantRows(supabase, sourceOrgId, sourceTemplateConstants.id)
  : []

const targetProducts = await loadAllProducts(supabase, targetOrgId)
const productIdMap = buildProductIdMap(sourceProducts, targetProducts)
const plannedProductCreates = sourceProducts.filter((product) => productIdMap.get(product.id)?.create)
const plannedProductUpdates = sourceProducts.filter((product) => !productIdMap.get(product.id)?.create)

const remappedSettingValues = sourceActiveSet.values.map((row) => ({
  ...row,
  value_json: remapJsonProductIds(row.value_json, productIdMap),
}))
const remappedTemplateSettings = sourceTemplateSettings
  ? remapTemplateSettings(sourceTemplateSettings, productIdMap)
  : null
const remappedTemplateRows = sourceTemplateRows.map((row) => ({
  ...row,
  values_json: remapJsonProductIds(row.values_json, productIdMap),
}))

const targetActiveSet = await loadActiveSettingSetSnapshot(supabase, targetOrgId)
const nextVersionNumber = await loadNextSettingSetVersionNumber(supabase, targetOrgId)

output(`Source org: ${sourceOrgId}`)
output(`Target org: ${targetOrgId}`)
output(`Source products: ${sourceProducts.length}`)
output(`Products to create in target: ${plannedProductCreates.length}`)
output(`Products to reuse/update in target: ${plannedProductUpdates.length}`)
output(`Source active setting values: ${sourceActiveSet.values.length}`)
output(`Target active setting set exists: ${targetActiveSet ? 'yes' : 'no'}`)
output(`Next target setting-set version: ${nextVersionNumber}`)

if (dryRun) {
  output('')
  output('Dry run only. No changes applied.')
  process.exit(0)
}

await upsertProducts({
  supabase,
  sourceProducts,
  productIdMap,
  targetOrgId,
})

const nowIso = new Date().toISOString()

if (targetActiveSet) {
  const { error: retireError } = await supabase
    .from('estimator_setting_set')
    .update({
      status: 'retired',
      retired_at: nowIso,
      notes: appendNote(targetActiveSet.set.notes, 'Retired by seed-estimator-org'),
    })
    .eq('org_id', targetOrgId)
    .eq('id', targetActiveSet.set.id)

  throwIf(retireError, 'Failed to retire target active estimator setting set')
}

const newSettingSetId = randomUUID()
const { error: insertSettingSetError } = await supabase.from('estimator_setting_set').insert({
  id: newSettingSetId,
  org_id: targetOrgId,
  version_number: nextVersionNumber,
  status: 'active',
  source_set_id: null,
  notes: `Seeded from org ${sourceOrgId} set ${sourceActiveSet.set.id}`,
  activated_at: nowIso,
})

throwIf(insertSettingSetError, 'Failed to insert target active estimator setting set')

const settingValueRows = remappedSettingValues.map((row) => ({
  id: randomUUID(),
  org_id: targetOrgId,
  setting_set_id: newSettingSetId,
  category_key: row.category_key,
  row_id: row.row_id,
  scalar_key: row.scalar_key,
  display_name: row.display_name,
  active: row.active,
  sort_order: row.sort_order,
  value_json: row.value_json ?? {},
}))

if (settingValueRows.length > 0) {
  const { error: insertValuesError } = await supabase
    .from('estimator_setting_value')
    .insert(settingValueRows)

  throwIf(insertValuesError, 'Failed to insert estimator setting values')
}

if (remappedTemplateSettings) {
  const { error: upsertTemplateSettingsError } = await supabase
    .from('estimate_template_settings')
    .upsert(
      {
        org_id: targetOrgId,
        ...remappedTemplateSettings,
      },
      { onConflict: 'org_id' }
    )

  throwIf(upsertTemplateSettingsError, 'Failed to upsert estimate_template_settings mirror')
}

let targetTemplateId = sourceTemplateConstants?.id ? null : null
if (sourceTemplateConstants) {
  const templateVersion =
    typeof sourceTemplateConstants.version === 'number' && Number.isFinite(sourceTemplateConstants.version)
      ? sourceTemplateConstants.version
      : 1
  const { data: upsertedTemplate, error: upsertTemplateError } = await supabase
    .from('estimator_template_constants')
    .upsert(
      {
        org_id: targetOrgId,
        version: templateVersion,
        seeded_at: sourceTemplateConstants.seeded_at ?? nowIso,
      },
      { onConflict: 'org_id' }
    )
    .select('id')
    .single()

  throwIf(upsertTemplateError, 'Failed to upsert estimator_template_constants mirror')
  targetTemplateId = upsertedTemplate.id

  const { error: deleteTemplateRowsError } = await supabase
    .from('estimator_template_constant_rows')
    .delete()
    .eq('org_id', targetOrgId)
    .eq('template_id', targetTemplateId)

  throwIf(deleteTemplateRowsError, 'Failed to clear target estimator_template_constant_rows mirror')

  if (remappedTemplateRows.length > 0) {
    const { error: insertTemplateRowsError } = await supabase
      .from('estimator_template_constant_rows')
      .insert(
        remappedTemplateRows.map((row) => ({
          id: randomUUID(),
          org_id: targetOrgId,
          template_id: targetTemplateId,
          category_key: row.category_key,
          row_id: row.row_id,
          display_name: row.display_name,
          active: row.active,
          sort_order: row.sort_order,
          values_json: row.values_json ?? {},
        }))
      )

    throwIf(
      insertTemplateRowsError,
      'Failed to insert estimator_template_constant_rows mirror'
    )
  }
}

output('')
output('Estimator seed complete.')
output(`Target active setting set: ${newSettingSetId}`)
output(`Products mirrored: ${sourceProducts.length}`)
output(`Setting values mirrored: ${settingValueRows.length}`)
output(`Template rows mirrored: ${remappedTemplateRows.length}`)

async function discoverSourceOrgId(client, excludedOrgId) {
  const { data, error } = await client
    .from('estimator_setting_set')
    .select('org_id, status')
    .eq('status', 'active')

  throwIf(error, 'Failed to discover source orgs')

  const candidateOrgIds = [...new Set((data ?? []).map((row) => row.org_id).filter(Boolean))].filter(
    (orgId) => orgId !== excludedOrgId
  )

  if (candidateOrgIds.length === 1) return candidateOrgIds[0]
  if (candidateOrgIds.length === 0) {
    fail('No non-target org with an active estimator setting set was found. Pass --source-org-id=<uuid>.')
  }

  output('Multiple possible source orgs found. Re-run with --source-org-id=<uuid>.')
  for (const orgId of candidateOrgIds) output(`- ${orgId}`)
  process.exit(1)
}

async function loadActiveSettingSetSnapshot(client, orgId) {
  const { data: setRow, error: setError } = await client
    .from('estimator_setting_set')
    .select('id, org_id, version_number, status, notes')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  throwIf(setError, `Failed to load active estimator setting set for org ${orgId}`)
  if (!setRow) return null

  const { data: valueRows, error: valueError } = await client
    .from('estimator_setting_value')
    .select(
      'id, org_id, setting_set_id, category_key, row_id, scalar_key, display_name, active, sort_order, value_json'
    )
    .eq('org_id', orgId)
    .eq('setting_set_id', setRow.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  throwIf(valueError, `Failed to load estimator setting values for org ${orgId}`)

  return {
    set: setRow,
    values: valueRows ?? [],
  }
}

async function loadTemplateSettings(client, orgId) {
  const { data, error } = await client
    .from('estimate_template_settings')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()

  throwIf(error, `Failed to load estimate_template_settings for org ${orgId}`)
  return data
}

async function loadTemplateConstants(client, orgId) {
  const { data, error } = await client
    .from('estimator_template_constants')
    .select('id, org_id, version, seeded_at')
    .eq('org_id', orgId)
    .maybeSingle()

  throwIf(error, `Failed to load estimator_template_constants for org ${orgId}`)
  return data
}

async function loadTemplateConstantRows(client, orgId, templateId) {
  const { data, error } = await client
    .from('estimator_template_constant_rows')
    .select(
      'id, org_id, template_id, category_key, row_id, display_name, active, sort_order, values_json'
    )
    .eq('org_id', orgId)
    .eq('template_id', templateId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  throwIf(error, `Failed to load estimator_template_constant_rows for org ${orgId}`)
  return data ?? []
}

async function loadAllProducts(client, orgId) {
  const { data, error } = await client
    .from('v2_products')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })

  throwIf(error, `Failed to load v2_products for org ${orgId}`)
  return data ?? []
}

async function loadNextSettingSetVersionNumber(client, orgId) {
  const { data, error } = await client
    .from('estimator_setting_set')
    .select('version_number')
    .eq('org_id', orgId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  throwIf(error, `Failed to load next estimator setting-set version for org ${orgId}`)
  const versionNumber = Number(data?.version_number ?? 0)
  return Number.isFinite(versionNumber) ? versionNumber + 1 : 1
}

function buildProductMatchKey(product) {
  const scopes = Array.isArray(product.default_scopes) ? [...product.default_scopes].sort().join('|') : ''
  return [
    String(product.name ?? '').trim().toLowerCase(),
    String(product.family ?? '').trim().toLowerCase(),
    String(product.base ?? '').trim().toLowerCase(),
    String(product.subtype ?? '').trim().toLowerCase(),
    scopes.toLowerCase(),
  ].join('::')
}

function buildProductIdMap(sourceProducts, targetProducts) {
  const targetByKey = new Map(targetProducts.map((product) => [buildProductMatchKey(product), product]))
  const map = new Map()

  for (const sourceProduct of sourceProducts) {
    const key = buildProductMatchKey(sourceProduct)
    const existingTarget = targetByKey.get(key)
    if (existingTarget) {
      map.set(sourceProduct.id, { id: existingTarget.id, create: false })
      continue
    }
    map.set(sourceProduct.id, { id: randomUUID(), create: true })
  }

  return map
}

async function upsertProducts(params) {
  const { supabase: client, sourceProducts, productIdMap, targetOrgId } = params
  for (const sourceProduct of sourceProducts) {
    const mapped = productIdMap.get(sourceProduct.id)
    if (!mapped) continue

    const payload = {
      id: mapped.id,
      org_id: targetOrgId,
      name: sourceProduct.name,
      family: sourceProduct.family,
      base: sourceProduct.base,
      subtype: sourceProduct.subtype,
      cost_per_unit: sourceProduct.cost_per_unit,
      coverage_sqft_per_gal_per_coat: sourceProduct.coverage_sqft_per_gal_per_coat,
      efficiency_pct: sourceProduct.efficiency_pct,
      default_coats: sourceProduct.default_coats,
      default_sheen: sourceProduct.default_sheen,
      default_scopes: sourceProduct.default_scopes,
      notes: sourceProduct.notes,
      status: sourceProduct.status,
    }

    if (mapped.create) {
      const { error } = await client.from('v2_products').insert(payload)
      throwIf(error, `Failed to insert product '${sourceProduct.name}' into target org`)
      continue
    }

    const { error } = await client
      .from('v2_products')
      .update(payload)
      .eq('org_id', targetOrgId)
      .eq('id', mapped.id)

    throwIf(error, `Failed to update matching target product '${sourceProduct.name}'`)
  }
}

function remapTemplateSettings(settings, productIdMap) {
  const next = { ...settings }
  delete next.org_id
  delete next.updated_at
  next.walls_paint_id = remapProductId(next.walls_paint_id, productIdMap)
  next.walls_primer_id = remapProductId(next.walls_primer_id, productIdMap)
  next.ceiling_paint_id = remapProductId(next.ceiling_paint_id, productIdMap)
  next.ceiling_primer_id = remapProductId(next.ceiling_primer_id, productIdMap)
  next.trim_paint_id = remapProductId(next.trim_paint_id, productIdMap)
  next.trim_primer_id = remapProductId(next.trim_primer_id, productIdMap)
  return next
}

function remapProductId(value, productIdMap) {
  if (typeof value !== 'string' || !value) return value
  return productIdMap.get(value)?.id ?? value
}

function remapJsonProductIds(value, productIdMap) {
  if (typeof value === 'string') return remapProductId(value, productIdMap)
  if (Array.isArray(value)) return value.map((entry) => remapJsonProductIds(entry, productIdMap))
  if (!value || typeof value !== 'object') return value

  const next = {}
  for (const [key, entryValue] of Object.entries(value)) {
    next[key] = remapJsonProductIds(entryValue, productIdMap)
  }
  return next
}

function appendNote(existing, suffix) {
  const base = String(existing ?? '').trim()
  return base ? `${base}\n${suffix}` : suffix
}

function throwIf(error, message) {
  if (!error) return
  fail(`${message}: ${error.message}`)
}

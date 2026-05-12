import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

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

const args = process.argv.slice(2)
const argSet = new Set(args)

function getArgValue(name) {
  const prefix = `${name}=`
  const match = args.find((arg) => arg.startsWith(prefix))
  return match ? match.slice(prefix.length) : null
}

function output(message = '') {
  process.stdout.write(`${message}\n`)
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (argSet.has('--help') || argSet.has('-h')) {
  output(`
Import Sherwin-Williams colors into paint_color_catalog.

Usage:
  npm run seed:sw-colors -- --org-id=<uuid> --file=./sw-colors.csv
  npm run seed:sw-colors -- --org-id=<uuid> --file=./sw-colors.json
  npm run seed:sw-colors -- --org-id=<uuid> --starter
  npm run seed:sw-colors -- --org-id=<uuid> --file=./sw-colors.csv --dry-run

Expected CSV headers:
  external_code,name,family,hex,lrv,collection,active

Accepted aliases:
  code, color_number, sw_number -> external_code
  color_name -> name
  hex_color -> hex
  collection_name -> collection
  status -> active/status mapping

The script does not scrape vendor websites. Use an authorized export for full catalog coverage.
`)
  process.exit(0)
}

const dryRun = argSet.has('--dry-run')
const useStarter = argSet.has('--starter')
const orgId = getArgValue('--org-id') || process.env.CODEX_BROWSER_TEST_ORG_ID?.trim() || null
const filePath = getArgValue('--file')

if (!orgId) fail('Missing --org-id and CODEX_BROWSER_TEST_ORG_ID is not set.')
if (!filePath && !useStarter) fail('Pass --file=<path> or --starter.')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  fail('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.')
}

if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
  fail('Refusing to run SW catalog import while NODE_ENV or VERCEL_ENV is production.')
}

const inputRows = useStarter ? starterRows() : readInputRows(filePath)
const normalizedRows = inputRows.map(normalizeInputRow).filter(Boolean)

if (normalizedRows.length === 0) fail('No valid color rows found.')

const duplicateCodes = findDuplicates(normalizedRows.map((row) => row.external_code))
if (duplicateCodes.length > 0) {
  fail(`Duplicate external_code values in input: ${duplicateCodes.join(', ')}`)
}

output(`Org: ${orgId}`)
output(`Rows parsed: ${inputRows.length}`)
output(`Rows valid: ${normalizedRows.length}`)
output(`Dry run: ${dryRun ? 'yes' : 'no'}`)

if (dryRun) {
  output('')
  for (const row of normalizedRows.slice(0, 10)) {
    output(`${row.external_code} ${row.name}`)
  }
  if (normalizedRows.length > 10) output(`...${normalizedRows.length - 10} more`)
  process.exit(0)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const brand = await upsertBrand(supabase, orgId)
await upsertColors(supabase, orgId, brand.id, normalizedRows)

output('')
output(`SW catalog import complete. Upserted ${normalizedRows.length} rows.`)

function readInputRows(rawPath) {
  const absolutePath = path.resolve(cwd, rawPath)
  if (!existsSync(absolutePath)) fail(`File not found: ${absolutePath}`)

  const text = readFileSync(absolutePath, 'utf8')
  if (absolutePath.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) fail('JSON input must be an array of color rows.')
    return parsed
  }

  return parseCsv(text)
}

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
      continue
    }
    if (char === ',') {
      row.push(field)
      field = ''
      continue
    }
    if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }
    if (char !== '\r') field += char
  }

  row.push(field)
  rows.push(row)

  const [headersRaw, ...dataRows] = rows.filter((entry) =>
    entry.some((fieldValue) => String(fieldValue ?? '').trim())
  )
  if (!headersRaw) return []

  const headers = headersRaw.map((header) => normalizeHeader(header))
  return dataRows.map((values) => {
    const record = {}
    headers.forEach((header, index) => {
      record[header] = values[index] ?? ''
    })
    return record
  })
}

function normalizeHeader(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function readField(row, names) {
  for (const name of names) {
    const value = row[name]
    if (value != null && String(value).trim()) return String(value).trim()
  }
  return ''
}

function normalizeInputRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null

  const normalized = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
  )
  const externalCode = normalizeExternalCode(
    readField(normalized, ['external_code', 'code', 'color_number', 'sw_number'])
  )
  const name = readField(normalized, ['name', 'color_name'])
  if (!externalCode || !name) return null

  const hex = normalizeHex(readField(normalized, ['hex', 'hex_color']))
  const lrv = normalizeLrv(readField(normalized, ['lrv']))
  const family = readField(normalized, ['family', 'color_family']) || null
  const collection = readField(normalized, ['collection', 'collection_name']) || null
  const active = normalizeActive(readField(normalized, ['active', 'status']))

  return {
    external_code: externalCode,
    name,
    family,
    hex,
    lrv,
    collection,
    active,
    metadata_json: {
      source: 'import-sw-colors',
      imported_at: new Date().toISOString(),
    },
  }
}

function normalizeExternalCode(value) {
  const text = String(value ?? '').trim().toUpperCase()
  if (!text) return ''
  const digits = text.match(/\d{4}/)?.[0]
  return digits ? `SW ${digits}` : text
}

function normalizeHex(value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  const prefixed = text.startsWith('#') ? text : `#${text}`
  return /^#[0-9a-f]{6}$/i.test(prefixed) ? prefixed.toUpperCase() : null
}

function normalizeLrv(value) {
  if (value == null || String(value).trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null
}

function normalizeActive(value) {
  const text = String(value ?? '').trim().toLowerCase()
  if (!text) return true
  return !['false', '0', 'n', 'no', 'inactive', 'archived', 'discontinued'].includes(text)
}

function findDuplicates(values) {
  const seen = new Set()
  const duplicates = new Set()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates]
}

async function upsertBrand(client, targetOrgId) {
  const { data, error } = await client
    .from('paint_brands')
    .upsert(
      {
        org_id: targetOrgId,
        name: 'sherwin-williams',
        display_name: 'Sherwin-Williams',
        external_ref: 'SW',
        status: 'active',
      },
      { onConflict: 'org_id,name' }
    )
    .select('id')
    .single()

  throwIf(error, 'Failed to upsert Sherwin-Williams brand')
  return data
}

async function upsertColors(client, targetOrgId, brandId, rows) {
  const payload = rows.map((row) => ({
    org_id: targetOrgId,
    brand_id: brandId,
    brand_display_name: 'Sherwin-Williams',
    color_number: row.external_code,
    external_code: row.external_code,
    color_name: row.name,
    name: row.name,
    display_name: `${row.external_code} ${row.name}`,
    family: row.family,
    hex_color: row.hex,
    hex: row.hex,
    lrv: row.lrv,
    collection_name: row.collection,
    collection: row.collection,
    status: row.active ? 'active' : 'archived',
    active: row.active,
    metadata_json: row.metadata_json,
  }))

  const chunkSize = 500
  for (let index = 0; index < payload.length; index += chunkSize) {
    const chunk = payload.slice(index, index + chunkSize)
    const { error } = await client
      .from('paint_color_catalog')
      .upsert(chunk, { onConflict: 'org_id,brand_id,external_code' })

    throwIf(error, `Failed to upsert color chunk starting at row ${index + 1}`)
  }
}

function starterRows() {
  return [
    { external_code: 'SW 7005', name: 'Pure White', family: 'white', collection: 'Starter SW colors' },
    { external_code: 'SW 7008', name: 'Alabaster', family: 'white', collection: 'Starter SW colors' },
    { external_code: 'SW 7015', name: 'Repose Gray', family: 'gray', collection: 'Starter SW colors' },
    { external_code: 'SW 7029', name: 'Agreeable Gray', family: 'gray', collection: 'Starter SW colors' },
    { external_code: 'SW 7069', name: 'Iron Ore', family: 'black', collection: 'Starter SW colors' },
    { external_code: 'SW 6258', name: 'Tricorn Black', family: 'black', collection: 'Starter SW colors' },
    { external_code: 'SW 6204', name: 'Sea Salt', family: 'green', collection: 'Starter SW colors' },
    { external_code: 'SW 6244', name: 'Naval', family: 'blue', collection: 'Starter SW colors' },
  ]
}

function throwIf(error, message) {
  if (!error) return
  fail(`${message}: ${error.message}`)
}

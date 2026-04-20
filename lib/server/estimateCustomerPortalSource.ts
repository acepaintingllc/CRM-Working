function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

export function isV2EstimateSchema(value: unknown) {
  const raw = asText(value).toLowerCase()
  return raw.includes('v2')
}

export function shouldUseV2EstimateCatalogSource(params: {
  sheetSchemaVersion?: unknown
  roomWallScopes?: unknown[]
  roomCeilingScopes?: unknown[]
  roomTrimScopes?: unknown[]
}) {
  if (isV2EstimateSchema(params.sheetSchemaVersion)) return true
  if (Array.isArray(params.roomWallScopes) && params.roomWallScopes.length > 0) return true
  if (Array.isArray(params.roomCeilingScopes) && params.roomCeilingScopes.length > 0) return true
  if (Array.isArray(params.roomTrimScopes) && params.roomTrimScopes.length > 0) return true
  return false
}

export function resolveEstimateCatalogSource(params: {
  sheetSchemaVersion?: unknown
  roomWallScopes?: unknown[]
  roomCeilingScopes?: unknown[]
  roomTrimScopes?: unknown[]
  catalogSource?: 'estimate' | 'v2'
}) {
  if (params.catalogSource) return params.catalogSource
  return shouldUseV2EstimateCatalogSource(params) ? 'v2' : 'estimate'
}

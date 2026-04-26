export type EstimateRouteCatalogSource = 'estimate' | 'v2'
export type EstimateRouteFamilyKey = 'estimate' | 'quote'

export type EstimateRouteFamily = {
  listHref: string
  editorHref: (estimateId: string) => string
  detailsHref: (estimateId: string) => string
  summaryHref: (estimateId: string) => string
  sendHref: (estimateId: string) => string
  estimateApiHref: (estimateId: string) => string
  catalogsApiHref: (
    estimateId: string,
    options?: { catalogSource?: EstimateRouteCatalogSource }
  ) => string
  customerSendApiHref: (
    estimateId: string,
    options?: { catalogSource?: EstimateRouteCatalogSource }
  ) => string
}

function withCatalogSourceQuery(path: string, catalogSource?: EstimateRouteCatalogSource) {
  return catalogSource === 'v2' ? `${path}?v2=1` : path
}

export const estimateRouteFamily: EstimateRouteFamily = {
  listHref: '/crm/quotes',
  editorHref: (estimateId) => `/crm/estimates/${estimateId}/v2`,
  detailsHref: (estimateId) => `/crm/estimates/${estimateId}/v2/details`,
  summaryHref: (estimateId) => `/crm/estimates/${estimateId}/v2/summary`,
  sendHref: (estimateId) => `/crm/estimates/${estimateId}/send`,
  estimateApiHref: (estimateId) => `/api/estimates/${estimateId}`,
  catalogsApiHref: (estimateId, options) =>
    withCatalogSourceQuery(`/api/estimates/${estimateId}/catalogs`, options?.catalogSource),
  customerSendApiHref: (estimateId, options) =>
    withCatalogSourceQuery(`/api/estimates/${estimateId}/customer-send`, options?.catalogSource),
}

export const quoteRouteFamily: EstimateRouteFamily = {
  listHref: '/crm/quotes',
  editorHref: (estimateId) => `/crm/quotes/${estimateId}`,
  detailsHref: (estimateId) => `/crm/quotes/${estimateId}/details`,
  summaryHref: (estimateId) => `/crm/quotes/${estimateId}/summary`,
  sendHref: (estimateId) => `/crm/quotes/${estimateId}/send`,
  estimateApiHref: (estimateId) => `/api/quotes/${estimateId}`,
  catalogsApiHref: (estimateId, options) =>
    withCatalogSourceQuery(`/api/quotes/${estimateId}/catalogs`, options?.catalogSource),
  customerSendApiHref: (estimateId, options) =>
    withCatalogSourceQuery(`/api/quotes/${estimateId}/customer-send`, options?.catalogSource),
}

export function resolveEstimateRouteFamily(key: EstimateRouteFamilyKey = 'estimate') {
  return key === 'quote' ? quoteRouteFamily : estimateRouteFamily
}

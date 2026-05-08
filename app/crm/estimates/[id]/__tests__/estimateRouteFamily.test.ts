import { describe, expect, it } from 'vitest'
import {
  estimateRouteFamily,
  isEstimateRouteFamilySendHref,
  quoteRouteFamily,
  quoteV2RouteFamily,
} from '../estimateRouteFamily'

describe('estimate route family', () => {
  it('builds details hrefs for estimate and quote route families', () => {
    expect(estimateRouteFamily.detailsHref('estimate-1')).toBe('/crm/estimates/estimate-1/v2/details')
    expect(quoteRouteFamily.detailsHref('estimate-1')).toBe('/crm/quotes/estimate-1/details')
    expect(quoteV2RouteFamily.detailsHref('estimate-1')).toBe('/crm/quotes/estimate-1/v2/details')
    expect(quoteV2RouteFamily.summaryHref('estimate-1')).toBe('/crm/quotes/estimate-1/v2/summary')
  })

  it('recognizes send hrefs for both estimate and quote route families', () => {
    expect(isEstimateRouteFamilySendHref(estimateRouteFamily.sendHref('estimate-1'))).toBe(true)
    expect(isEstimateRouteFamilySendHref(quoteRouteFamily.sendHref('estimate-1'))).toBe(true)
    expect(isEstimateRouteFamilySendHref(quoteV2RouteFamily.sendHref('estimate-1'))).toBe(true)
    expect(isEstimateRouteFamilySendHref(estimateRouteFamily.summaryHref('estimate-1'))).toBe(false)
  })
})

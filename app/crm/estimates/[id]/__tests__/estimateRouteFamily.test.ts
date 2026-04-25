import { describe, expect, it } from 'vitest'
import { estimateRouteFamily, quoteRouteFamily } from '../estimateRouteFamily'

describe('estimate route family', () => {
  it('builds details hrefs for estimate and quote route families', () => {
    expect(estimateRouteFamily.detailsHref('estimate-1')).toBe('/crm/estimates/estimate-1/v2/details')
    expect(quoteRouteFamily.detailsHref('estimate-1')).toBe('/crm/quotes/estimate-1/details')
  })
})

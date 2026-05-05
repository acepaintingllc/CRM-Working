import { describe, expect, it } from 'vitest'
import {
  buildEstimateFeedbackTrendsPath,
  buildInsightsTrendsPath,
  parseEstimateFeedbackTrendFilters,
  readEstimateFeedbackTrendFilterRawQuery,
  updateEstimateFeedbackTrendFilter,
} from '../trendFilters'

describe('estimate feedback trend filters', () => {
  it('parses supported query aliases into trend filters', () => {
    expect(
      parseEstimateFeedbackTrendFilters(
        new URLSearchParams(
          'start=2026-01-01&end=2026-01-31&job_type=interior&occupancy=occupied&condition_tags=peeling,trim-heavy&conditionTag=peeling&max_absolute_variance=12.5&maxAbsoluteTotalImpact=250'
        )
      )
    ).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
      jobType: 'interior',
      occupancy: 'occupied',
      conditionTags: ['peeling', 'trim-heavy'],
      maxAbsoluteVariance: 12.5,
      maxAbsoluteTotalImpact: 250,
    })
  })

  it('supports legacy locked date aliases and all condition tag variants', () => {
    expect(
      parseEstimateFeedbackTrendFilters(
        new URLSearchParams(
          'lockedFrom=2026-03-01&lockedTo=2026-03-31&conditionTag=furnished&conditionTags=walls&condition_tag=trim&condition_tags=walls'
        )
      )
    ).toMatchObject({
      from: '2026-03-01',
      to: '2026-03-31',
      conditionTags: ['furnished', 'walls', 'trim'],
    })
  })

  it('normalizes unsupported occupancy and invalid positive numbers to null', () => {
    expect(
      parseEstimateFeedbackTrendFilters(
        new URLSearchParams(
          'from=not-a-date&jobType='.concat(
            'x'.repeat(81),
            '&occupancy=unknown&maxAbsoluteVariance=-1&max_absolute_total_impact=abc'
          )
        )
      )
    ).toEqual({
      from: 'not-a-date',
      to: null,
      jobType: 'x'.repeat(81),
      occupancy: null,
      conditionTags: [],
      maxAbsoluteVariance: null,
      maxAbsoluteTotalImpact: null,
    })
  })

  it('builds API and CRM paths with canonical query names', () => {
    const filters = {
      from: '2026-01-01',
      to: '2026-01-31',
      jobType: 'interior',
      occupancy: 'occupied',
      conditionTags: ['peeling', 'trim-heavy'],
      maxAbsoluteVariance: 12.5,
      maxAbsoluteTotalImpact: 250,
    }

    expect(buildEstimateFeedbackTrendsPath(filters)).toBe(
      '/api/insights/trends?from=2026-01-01&to=2026-01-31&jobType=interior&occupancy=occupied&maxAbsoluteVariance=12.5&maxAbsoluteTotalImpact=250&conditionTag=peeling&conditionTag=trim-heavy'
    )
    expect(buildInsightsTrendsPath(filters)).toBe(
      '/crm/insights?from=2026-01-01&to=2026-01-31&jobType=interior&occupancy=occupied&maxAbsoluteVariance=12.5&maxAbsoluteTotalImpact=250&conditionTag=peeling&conditionTag=trim-heavy'
    )
  })

  it('omits invalid or null filters from built paths', () => {
    expect(
      buildInsightsTrendsPath({
        from: '2026-01-01',
        occupancy: 'unknown',
        conditionTags: ['peeling'],
        maxAbsoluteVariance: '-1',
        maxAbsoluteTotalImpact: 'abc',
      })
    ).toBe('/crm/insights?from=2026-01-01&conditionTag=peeling')
  })

  it('normalizes invalid edited filter values before writing URL state', () => {
    const filters = updateEstimateFeedbackTrendFilter(
      { from: '2026-01-01', conditionTags: ['peeling'] },
      'maxAbsoluteVariance',
      '-1'
    )

    expect(filters.maxAbsoluteVariance).toBeNull()
    expect(buildInsightsTrendsPath(filters)).toBe(
      '/crm/insights?from=2026-01-01&conditionTag=peeling'
    )
  })

  it('only allows edited occupancy values to become occupied, vacant, or null', () => {
    expect(
      updateEstimateFeedbackTrendFilter({}, 'occupancy', 'occupied').occupancy
    ).toBe('occupied')
    expect(
      updateEstimateFeedbackTrendFilter({}, 'occupancy', 'Vacant').occupancy
    ).toBe('vacant')
    expect(
      updateEstimateFeedbackTrendFilter({}, 'occupancy', 'unknown').occupancy
    ).toBeNull()
    expect(updateEstimateFeedbackTrendFilter({}, 'occupancy', '').occupancy).toBeNull()
  })

  it('keeps raw invalid values available for server route validation', () => {
    expect(
      readEstimateFeedbackTrendFilterRawQuery(
        new URLSearchParams('occupancy=unknown&maxAbsoluteVariance=-1')
      )
    ).toMatchObject({
      occupancy: 'unknown',
      maxAbsoluteVariance: '-1',
      maxAbsoluteTotalImpact: null,
    })
  })
})

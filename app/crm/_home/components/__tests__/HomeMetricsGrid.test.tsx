import { cleanup, render, screen } from '@testing-library/react'
import type { ComponentPropsWithoutRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HomeMetricsGrid } from '../HomeMetricsGrid'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: ComponentPropsWithoutRef<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

afterEach(() => {
  cleanup()
})

const metrics = {
  won: 3,
  lost: 3,
  total: 6,
  winRate: 50,
  avgTicket: 1200,
  salesTotal: 3600,
  pipelineTotal: 5400,
  totalEstimates: 8,
  openJobsCount: 5,
  openJobsTotal: 1800,
  openJobsAvgValue: 360,
}

describe('HomeMetricsGrid', () => {
  it('renders loading skeletons instead of metric values', () => {
    render(
      <HomeMetricsGrid
        viewModel={{
          metrics,
          isLoading: true,
          isUnavailable: false,
        }}
      />
    )

    expect(screen.queryByText('$3,600')).toBeNull()
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('renders unavailable states instead of misleading zeroes', () => {
    render(
      <HomeMetricsGrid
        viewModel={{
          metrics,
          isLoading: false,
          isUnavailable: true,
        }}
      />
    )

    expect(screen.getAllByText('Metrics unavailable').length).toBeGreaterThan(0)
    expect(screen.queryByText('$3,600')).toBeNull()
  })

  it('renders metric values when data is ready', () => {
    render(
      <HomeMetricsGrid
        viewModel={{
          metrics,
          isLoading: false,
          isUnavailable: false,
        }}
      />
    )

    expect(screen.getByText('$3,600')).toBeTruthy()
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0)
  })
})

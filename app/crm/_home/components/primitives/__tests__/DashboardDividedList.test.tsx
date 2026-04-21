import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DashboardDividedList } from '../DashboardDividedList'

afterEach(() => {
  cleanup()
})

describe('DashboardDividedList', () => {
  it('renders children inside the shared divided list container', () => {
    render(
      <DashboardDividedList className="custom-list">
        <div>Alpha</div>
        <div>Beta</div>
      </DashboardDividedList>
    )

    expect(screen.getByText('Alpha')).toBeTruthy()
    expect(screen.getByText('Beta')).toBeTruthy()
    expect(screen.getByText('Alpha').parentElement?.className).toContain('divide-y')
    expect(screen.getByText('Alpha').parentElement?.className).toContain('custom-list')
  })
})

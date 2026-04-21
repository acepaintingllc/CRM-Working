import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DashboardEmptyState } from '../DashboardEmptyState'

afterEach(() => {
  cleanup()
})

describe('DashboardEmptyState', () => {
  it('renders the fallback message', () => {
    render(<DashboardEmptyState message="No reminders today." />)

    expect(screen.getByText('No reminders today.')).toBeTruthy()
  })
})

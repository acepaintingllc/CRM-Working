import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentPropsWithoutRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardTabHeader } from '../DashboardTabHeader'

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

describe('DashboardTabHeader', () => {
  it('renders active and inactive tab semantics', async () => {
    const onSelect = vi.fn()

    render(
      <DashboardTabHeader
        label="Activity feed sections"
        activeKey="activity"
        onSelect={onSelect}
        tabIds={{ activity: 'activity-tab', tasks: 'tasks-tab' }}
        items={[
          { key: 'activity', label: 'Activity', type: 'button', panelId: 'activity-panel' },
          {
            key: 'tasks',
            label: 'Tasks',
            type: 'link',
            href: '/crm/tasks',
            panelId: 'activity-panel',
          },
        ]}
      />
    )

    const activityTab = screen.getByRole('tab', { name: 'Activity' })
    const tasksTab = screen.getByRole('tab', { name: 'Tasks' })

    expect(activityTab.getAttribute('aria-selected')).toBe('true')
    expect(tasksTab.getAttribute('aria-selected')).toBe('false')

    await userEvent.click(activityTab)
    expect(onSelect).toHaveBeenCalledWith('activity')
  })
})

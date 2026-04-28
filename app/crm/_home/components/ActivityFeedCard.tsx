import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useId } from 'react'
import { getActivityStatusDisplay } from '../display'
import { formatStatus } from '@/lib/crm/home/formatters'
import { DashboardCardShell } from './primitives/DashboardCardShell'
import { DashboardDividedList } from './primitives/DashboardDividedList'
import { DashboardEmptyState } from './primitives/DashboardEmptyState'
import { DashboardTabHeader } from './primitives/DashboardTabHeader'
import { crmMutedTextStyle, crmTextStyle } from './primitives/tokens'

type ActivityFeedCardProps = {
  viewModel: {
    items: Array<{
      id: string
      href: string
      title: string
      customerName: string
      amountLabel: string | null
      status: string | null
    }>
    isEmpty: boolean
    isUnavailable: boolean
    emptyMessage: string
    unavailableMessage: string
    tasksHref: string
    viewAllHref: string | null
    viewAllLabel: string | null
  }
}

export function ActivityFeedCard({ viewModel }: ActivityFeedCardProps) {
  const id = useId()
  const activityTabId = `${id}-activity-tab`
  const tasksTabId = `${id}-tasks-tab`
  const activityPanelId = `${id}-activity-panel`

  return (
    <DashboardCardShell>
      <DashboardTabHeader
        label="Activity feed sections"
        activeKey="activity"
        onSelect={() => {}}
        tabIds={{ activity: activityTabId, tasks: tasksTabId }}
        items={[
          { key: 'activity', label: 'Activity', type: 'button', panelId: activityPanelId },
          {
            key: 'tasks',
            label: 'Tasks',
            type: 'link',
            panelId: activityPanelId,
            href: viewModel.tasksHref,
          },
        ]}
      />

      <div id={activityPanelId} role="tabpanel" aria-labelledby={activityTabId} className="px-4 py-3 md:px-5 md:py-4">
        {viewModel.isUnavailable ? (
          <DashboardEmptyState message={viewModel.unavailableMessage} />
        ) : viewModel.isEmpty ? (
          <DashboardEmptyState message={viewModel.emptyMessage} />
        ) : (
          <DashboardDividedList>
            {viewModel.items.map((item, index) => {
              const status = getActivityStatusDisplay(item.status)
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`group flex min-w-0 gap-3 py-3 transition ${index >= 3 ? 'hidden md:flex' : ''}`}
                >
                  <div
                    className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-extrabold"
                    style={{ background: status.background, color: status.color }}
                  >
                    {status.badge}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold" style={crmTextStyle}>
                      {item.title}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-xs" style={crmMutedTextStyle}>
                        {item.customerName}
                      </span>
                      {item.amountLabel ? (
                        <span className="text-xs font-semibold" style={{ color: 'var(--crm-text-soft)' }}>
                          {'\u2022'} {item.amountLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="hidden max-w-[5.5rem] flex-shrink-0 truncate self-center text-xs font-semibold sm:block" style={crmMutedTextStyle}>
                    {formatStatus(item.status)}
                  </div>
                </Link>
              )
            })}
          </DashboardDividedList>
        )}

        {viewModel.viewAllHref && viewModel.viewAllLabel ? (
          <Link
            href={viewModel.viewAllHref}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
            style={crmMutedTextStyle}
          >
            {viewModel.viewAllLabel} <ArrowRight size={11} />
          </Link>
        ) : null}
      </div>
    </DashboardCardShell>
  )
}

import Link from 'next/link'
import { getReminderToneDisplay } from '../display'
import { DashboardEmptyState } from './primitives/DashboardEmptyState'
import { DashboardSectionHeader } from './primitives/DashboardSectionHeader'
import { crmTextStyle } from './primitives/tokens'

type ReminderSignalsPanelProps = {
  panelId: string
  tabId: string
  viewModel: {
    loading: boolean
    isEmpty: boolean
    errors: string[]
    emptyMessage: string
    count: number
    items: Array<{
      key: string
      href: string
      title: string
      subtitle: string
      tone: 'danger' | 'default'
    }>
  }
}

export function ReminderSignalsPanel({
  panelId,
  tabId,
  viewModel,
}: ReminderSignalsPanelProps) {
  return (
    <div id={panelId} role="tabpanel" aria-labelledby={tabId}>
      {viewModel.loading ? (
        <DashboardEmptyState message="Loading..." />
      ) : viewModel.errors.length > 0 ? (
        <div className="grid gap-2 py-4 text-sm" style={{ color: 'var(--crm-danger-text)' }}>
          {viewModel.errors.map((error) => (
            <div key={error}>{error}</div>
          ))}
        </div>
      ) : viewModel.isEmpty ? (
        <DashboardEmptyState message={viewModel.emptyMessage} />
      ) : (
        <>
          <DashboardSectionHeader
            label="Reminders"
            className="mb-2"
            badge={
              <span
                className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold"
                style={{ background: 'var(--crm-border)', color: 'var(--crm-muted)' }}
              >
                {viewModel.count}
              </span>
            }
          />
          <div className="grid gap-2">
            {viewModel.items.map((item) => {
              const toneDisplay = getReminderToneDisplay(item.tone)
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="flex items-start gap-2 rounded-lg border p-2.5 transition"
                  style={{
                    borderColor: toneDisplay.borderColor,
                    background: toneDisplay.background,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold" style={crmTextStyle}>
                      {item.title}
                    </div>
                    <div className="text-xs" style={{ color: toneDisplay.textColor }}>
                      {item.subtitle}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

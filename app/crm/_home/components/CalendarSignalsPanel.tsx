import Link from 'next/link'
import { DashboardDividedList } from './primitives/DashboardDividedList'
import { DashboardEmptyState } from './primitives/DashboardEmptyState'
import { crmMutedTextStyle, crmTextStyle } from './primitives/tokens'

type CalendarSignalsPanelProps = {
  panelId: string
  tabId: string
  viewModel: {
    loading: boolean
    errors: string[]
    disconnected: boolean
    disconnectedMessage: string
    connectHref: string
    connectLabel: string
    emptyMessage: string
    events: Array<{
      key: string
      title: string
      subtitle: string
      href: string | null
    }>
  }
}

export function CalendarSignalsPanel({
  panelId,
  tabId,
  viewModel,
}: CalendarSignalsPanelProps) {
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
      ) : viewModel.disconnected ? (
        <div className="grid gap-2 py-4">
          <div className="text-sm" style={crmMutedTextStyle}>
            {viewModel.disconnectedMessage}
          </div>
          <Link
            href={viewModel.connectHref}
            className="inline-flex w-fit items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold"
            style={{ background: 'var(--crm-accent)', color: 'var(--crm-accent-text)' }}
          >
            {viewModel.connectLabel}
          </Link>
        </div>
      ) : viewModel.events.length === 0 ? (
        <DashboardEmptyState message={viewModel.emptyMessage} />
      ) : (
        <DashboardDividedList>
          {viewModel.events.map((event) => (
            <div key={event.key} className="min-w-0 py-3">
              <div className="break-words text-sm font-semibold" style={crmTextStyle}>
                {event.title}
              </div>
              <div className="mt-0.5 break-words text-xs leading-5" style={crmMutedTextStyle}>
                {event.subtitle}
              </div>
              {event.href ? (
                <a
                  href={event.href}
                  target="_blank"
                  rel="noreferrer"
                  className="crm-calendar-open-link mt-1 inline-flex text-xs font-semibold underline-offset-2 hover:underline"
                  style={crmMutedTextStyle}
                >
                  Open event
                </a>
              ) : null}
            </div>
          ))}
        </DashboardDividedList>
      )}
    </div>
  )
}

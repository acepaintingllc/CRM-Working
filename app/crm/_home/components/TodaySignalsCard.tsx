import { useId, useState } from 'react'
import { CalendarSignalsPanel } from './CalendarSignalsPanel'
import { DashboardCardShell } from './primitives/DashboardCardShell'
import { ReminderSignalsPanel } from './ReminderSignalsPanel'
import { SignalsFooterActions } from './SignalsFooterActions'
import { SignalsTabs } from './SignalsTabs'

type TodaySignalsCardProps = {
  viewModel: {
    calendarTabLabel: string
    remindersTabLabel: string
    calendar: {
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
    reminders: {
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
    footerActions: Array<{
      href: string
      label: string
      icon: 'calendar' | 'notes'
    }>
  }
}

export function TodaySignalsCard({ viewModel }: TodaySignalsCardProps) {
  const [activeTab, setActiveTab] = useState<'calendar' | 'reminders'>('calendar')
  const id = useId()
  const calendarTabId = `${id}-calendar-tab`
  const remindersTabId = `${id}-reminders-tab`
  const calendarPanelId = `${id}-calendar-panel`
  const remindersPanelId = `${id}-reminders-panel`

  return (
    <DashboardCardShell className="p-0">
      <SignalsTabs
        calendarTabId={calendarTabId}
        remindersTabId={remindersTabId}
        calendarPanelId={calendarPanelId}
        remindersPanelId={remindersPanelId}
        activeTab={activeTab}
        calendarLabel={viewModel.calendarTabLabel}
        remindersLabel={viewModel.remindersTabLabel}
        onSelectTab={setActiveTab}
      />

      <div className="px-5 py-4">
        {activeTab === 'calendar' ? (
          <CalendarSignalsPanel
            panelId={calendarPanelId}
            tabId={calendarTabId}
            viewModel={viewModel.calendar}
          />
        ) : (
          <ReminderSignalsPanel
            panelId={remindersPanelId}
            tabId={remindersTabId}
            viewModel={viewModel.reminders}
          />
        )}
      </div>

      <SignalsFooterActions actions={viewModel.footerActions} />
    </DashboardCardShell>
  )
}

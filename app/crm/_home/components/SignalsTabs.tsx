import { DashboardTabHeader } from './primitives/DashboardTabHeader'

type SignalsTabsProps = {
  calendarTabId: string
  remindersTabId: string
  calendarPanelId: string
  remindersPanelId: string
  activeTab: 'calendar' | 'reminders'
  calendarLabel: string
  remindersLabel: string
  onSelectTab: (tab: 'calendar' | 'reminders') => void
}

export function SignalsTabs({
  calendarTabId,
  remindersTabId,
  calendarPanelId,
  remindersPanelId,
  activeTab,
  calendarLabel,
  remindersLabel,
  onSelectTab,
}: SignalsTabsProps) {
  return (
    <DashboardTabHeader
      label="Today's signals"
      activeKey={activeTab}
      onSelect={(tab) => onSelectTab(tab as 'calendar' | 'reminders')}
      tabIds={{
        calendar: calendarTabId,
        reminders: remindersTabId,
      }}
      items={[
        { key: 'calendar', label: calendarLabel, type: 'button', panelId: calendarPanelId },
        { key: 'reminders', label: remindersLabel, type: 'button', panelId: remindersPanelId },
      ]}
    />
  )
}

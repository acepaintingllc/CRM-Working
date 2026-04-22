'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import {
  CalendarPicker,
  MonthBoard,
  SelectedDayPanel,
} from '@/lib/crm/calendar/components'
import { useCalendarPage } from '@/lib/crm/calendar/useCalendarPage'

export default function CalendarPage() {
  const {
    bootstrapLoading,
    calendarById,
    calendars,
    connect,
    connected,
    disconnect,
    error,
    events,
    eventsError,
    eventsLoading,
    goToNextMonth,
    goToPreviousMonth,
    goToToday,
    monthWeekRows,
    openGoogleUrl,
    refreshAll,
    selectDay,
    selectedCalendarIds,
    selectedDay,
    selectedDayEvents,
    selectedDayKey,
    today,
    toggleCalendar,
    visibleMonth,
  } = useCalendarPage()

  return (
    <CrmPageShell className="max-w-[1460px]">
      <CrmPageHeader
        eyebrow="Scheduling"
        emoji="🗓️"
        title="Calendar"
        description="Month board from Google Calendar. Use Google for editing while the CRM manages connection state and schedule visibility."
        actions={
          <>
            <CrmButton type="button" onClick={() => void refreshAll()}>
              Refresh
            </CrmButton>
            {connected ? (
              <CrmButton type="button" onClick={() => void disconnect()}>
                Disconnect
              </CrmButton>
            ) : (
              <CrmButton type="button" onClick={() => void connect()} tone="primary">
                Connect Google
              </CrmButton>
            )}
            <CrmButton href={openGoogleUrl} target="_blank" rel="noreferrer">
              Open in Google
            </CrmButton>
          </>
        }
      />

      {error ? <CrmNotice tone="error" emoji="⚠️">{error}</CrmNotice> : null}

      {connected === false ? (
        <CrmEmptyState
          emoji="📆"
          title="Connect Google Calendar"
          description="Connect Google Calendar before the CRM can load calendars, event blocks, and selected-day details."
          action={
            <CrmButton type="button" onClick={() => void connect()} tone="primary">
              Connect Google
            </CrmButton>
          }
        />
      ) : connected === null ? (
        <CrmSectionCard title="Loading calendar" emoji="⏳">
          <div className="text-sm text-[color:var(--crm-ui-muted)]">Loading calendar...</div>
        </CrmSectionCard>
      ) : (
        <>
          <CrmSectionCard
            title="Visible calendars"
            description="Choose which Google calendars appear on the month board."
            variant="compact"
          >
            <CalendarPicker
              calendars={calendars}
              selectedCalendarIds={selectedCalendarIds}
              toggleCalendar={toggleCalendar}
            />
          </CrmSectionCard>

          <div className="calendar-shell">
            <CrmSectionCard
              className="p-0"
              title="Month board"
              description="Review scheduled activity and jump into day details."
            >
              <MonthBoard
                calendarById={calendarById}
                events={events}
                eventsError={eventsError}
                eventsLoading={eventsLoading}
                goToNextMonth={goToNextMonth}
                goToPreviousMonth={goToPreviousMonth}
                goToToday={goToToday}
                monthWeekRows={monthWeekRows}
                onSelectDay={selectDay}
                selectedCalendarIds={selectedCalendarIds}
                selectedDayKey={selectedDayKey}
                today={today}
                visibleMonth={visibleMonth}
              />
            </CrmSectionCard>

            <aside className="calendar-side-panel">
              <CrmSectionCard
                title="Selected day"
                description="Inspect events for the active date."
                variant="rail"
              >
                <SelectedDayPanel
                  calendarById={calendarById}
                  selectedDay={selectedDay}
                  selectedDayEvents={selectedDayEvents}
                />
              </CrmSectionCard>
            </aside>
          </div>
        </>
      )}

      {bootstrapLoading ? (
        <CrmNotice tone="info" compact>
          Syncing calendar state...
        </CrmNotice>
      ) : null}

      <style jsx global>{`
        .calendar-shell {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 12px;
        }

        .month-panel,
        .selected-day-card {
          background: var(--crm-card);
          border: 1px solid var(--crm-border-soft);
          border-radius: 16px;
          padding: 12px;
        }

        .month-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          padding: 16px 16px 0;
        }

        .month-title {
          font-size: 22px;
          font-weight: 900;
          color: var(--crm-text);
        }

        .month-subtitle {
          margin-top: 2px;
          font-size: 12px;
          font-weight: 700;
          color: var(--crm-muted);
        }

        .month-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }

        .month-board {
          border-top: 1px solid var(--crm-border-soft);
          overflow-x: auto;
          background: var(--crm-card);
        }

        .month-weekday-row {
          display: grid;
          grid-template-columns: repeat(7, minmax(138px, 1fr));
          min-width: 966px;
          border-bottom: 1px solid var(--crm-border-soft);
        }

        .weekday-label {
          height: 30px;
          display: grid;
          place-items: center;
          font-size: 11px;
          font-weight: 900;
          color: var(--crm-text);
          border-left: 1px solid var(--crm-border-soft);
        }

        .weekday-label:first-child {
          border-left: 0;
        }

        .month-week {
          position: relative;
          display: grid;
          grid-template-columns: repeat(7, minmax(138px, 1fr));
          min-width: 966px;
          border-bottom: 1px solid var(--crm-border-soft);
        }

        .month-week:last-child {
          border-bottom: 0;
        }

        .day-cell {
          appearance: none;
          border: 0;
          border-left: 1px solid var(--crm-border-soft);
          background: transparent;
          align-self: stretch;
          display: block;
          height: 100%;
          min-height: inherit;
          padding: 8px 8px 6px;
          text-align: center;
          cursor: pointer;
          position: relative;
        }

        .day-cell:first-child {
          border-left: 0;
        }

        .day-cell[data-muted='true'] {
          background: var(--crm-bg-soft);
          color: var(--crm-muted);
        }

        .day-cell[data-selected='true'] {
          box-shadow: inset 0 0 0 2px var(--crm-accent);
        }

        .day-number {
          display: grid;
          place-items: center;
          min-width: 24px;
          height: 24px;
          padding: 0 6px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          color: var(--crm-text);
          left: 50%;
          position: absolute;
          top: 8px;
          transform: translateX(-50%);
        }

        .day-cell[data-muted='true'] .day-number {
          color: var(--crm-muted);
        }

        .today-number {
          background: #2563eb;
          color: white;
        }

        .event-layer {
          position: absolute;
          left: 0;
          right: 0;
          top: 38px;
          display: grid;
          grid-template-columns: repeat(7, minmax(138px, 1fr));
          grid-auto-rows: 20px;
          gap: 4px 0;
          padding: 0 7px;
          pointer-events: none;
        }

        .event-segment {
          min-width: 0;
          height: 20px;
          border: 0;
          border-radius: 5px;
          padding: 0 8px;
          font-size: 12px;
          font-weight: 850;
          line-height: 20px;
          text-align: left;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          text-decoration: none;
          pointer-events: auto;
          cursor: pointer;
        }

        .event-bar {
          box-shadow: 0 1px 1px rgba(15, 23, 42, 0.08);
        }

        .event-dot {
          position: relative;
          background: transparent;
          color: var(--crm-text);
          padding-left: 18px;
        }

        .event-dot::before {
          content: '';
          position: absolute;
          left: 7px;
          top: 7px;
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: var(--event-color, #0ea5e9);
        }

        .calendar-side-panel {
          display: grid;
          gap: 12px;
          align-content: start;
        }

        .detail-event {
          border: 1px solid var(--crm-border-soft);
          border-radius: 12px;
          padding: 10px;
          background: var(--crm-card);
        }

        @media (max-width: 760px) {
          .month-toolbar {
            align-items: flex-start;
            flex-direction: column;
          }

          .month-actions {
            justify-content: flex-start;
          }

          .month-board {
            margin-left: -4px;
            margin-right: -4px;
          }
        }

        @media (min-width: 1180px) {
          .calendar-shell {
            grid-template-columns: minmax(0, 1fr) 340px;
            align-items: start;
          }

          .calendar-side-panel {
            position: sticky;
            top: 12px;
          }
        }
      `}</style>
    </CrmPageShell>
  )
}

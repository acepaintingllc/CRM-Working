'use client'

import type { CSSProperties } from 'react'

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
    <div className="crm-page" style={{ maxWidth: 1460, margin: '0 auto' }}>
      <div className="crm-topbar" style={{ marginBottom: 10 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Calendar</h1>
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--crm-muted)' }}>
            Month board from Google Calendar. Use Google for editing.
          </div>
        </div>

        <div className="crm-actions" style={{ gap: 8 }}>
          <button onClick={() => void refreshAll()} style={button}>
            Refresh
          </button>
          {connected ? (
            <button onClick={() => void disconnect()} style={button}>
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => void connect()}
              style={{ ...button, background: 'var(--crm-accent)', color: 'var(--crm-accent-text)', border: '1px solid var(--crm-accent)' }}
            >
              Connect Google
            </button>
          )}
          <a
            href={openGoogleUrl}
            target="_blank"
            rel="noreferrer"
            style={{ ...button, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            Open in Google
          </a>
        </div>
      </div>

      {error ? (
        <div
          style={{
            marginBottom: 10,
            background: 'var(--crm-card)',
            border: '1px solid #fecaca',
            borderRadius: 12,
            padding: 12,
            color: '#991b1b',
          }}
        >
          {error}
        </div>
      ) : null}

      {connected === false ? (
        <div
          style={{
            marginTop: 12,
            background: 'var(--crm-card)',
            border: '1px solid var(--crm-border-soft)',
            borderRadius: 16,
            padding: 18,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--crm-text)' }}>Connect Google Calendar</div>
          <button
            onClick={() => void connect()}
            style={{ ...button, marginTop: 14, background: 'var(--crm-accent)', color: 'var(--crm-accent-text)', border: '1px solid var(--crm-accent)' }}
          >
            Connect Google
          </button>
        </div>
      ) : connected === null ? (
        <div style={{ marginTop: 12, color: 'var(--crm-muted)' }}>Loading calendar...</div>
      ) : (
        <>
          <CalendarPicker
            calendars={calendars}
            selectedCalendarIds={selectedCalendarIds}
            toggleCalendar={toggleCalendar}
          />

          <div className="calendar-shell">
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

            <aside className="calendar-side-panel">
              <SelectedDayPanel
                calendarById={calendarById}
                selectedDay={selectedDay}
                selectedDayEvents={selectedDayEvents}
              />
            </aside>
          </div>
        </>
      )}

      {bootstrapLoading ? <div style={{ marginTop: 10, color: 'var(--crm-muted)' }}>Syncing...</div> : null}

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
          border: 1px solid var(--crm-border-soft);
          border-radius: 14px;
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
            border-radius: 12px;
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
    </div>
  )
}

const button: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--crm-border-soft)',
  background: 'var(--crm-card)',
  color: 'var(--crm-text)',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
}

'use client'

import type { CSSProperties } from 'react'

import {
  dayNumberLabel,
  eventLabel,
  formatEventTime,
  getContrastText,
  localDateKey,
  monthTitle,
  sameLocalDay,
} from './helpers'
import type { CalendarEvent, CalendarInfo, MonthWeekRow, WeekSegment } from './types'

const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

type EventSegmentProps = {
  calendarName: string
  color: string
  onSelectDay: () => void
  segment: WeekSegment
  textColor: string
}

export function EventSegment({
  calendarName,
  color,
  onSelectDay,
  segment,
  textColor,
}: EventSegmentProps) {
  const label = eventLabel(segment.event)
  const timedDotStyle = segment.bar ? undefined : ({ '--event-color': color } as CSSProperties)
  const commonProps = {
    className: segment.bar ? 'event-segment event-bar' : 'event-segment event-dot',
    style: {
      gridColumn: `${segment.startIndex + 1} / ${segment.endIndex + 2}`,
      gridRow: `${segment.row + 1}`,
      background: segment.bar ? color : 'transparent',
      color: segment.bar ? textColor : 'var(--crm-text)',
      ...timedDotStyle,
    },
    title: `${label} - ${calendarName}`,
  }

  if (segment.event.htmlLink) {
    return (
      <a
        {...commonProps}
        href={segment.event.htmlLink}
        target="_blank"
        rel="noreferrer"
      >
        {label}
      </a>
    )
  }

  return (
    <button {...commonProps} type="button" onClick={onSelectDay}>
      {label}
    </button>
  )
}

type CalendarPickerProps = {
  calendars: CalendarInfo[]
  selectedCalendarIds: string[]
  toggleCalendar: (calendarId: string) => void
}

export function CalendarPicker({
  calendars,
  selectedCalendarIds,
  toggleCalendar,
}: CalendarPickerProps) {
  return (
    <div
      style={{
        marginBottom: 10,
        background: 'var(--crm-card)',
        border: '1px solid var(--crm-border-soft)',
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800 }}>Calendars</div>
        <div style={{ fontSize: 12, color: 'var(--crm-muted)' }}>
          {selectedCalendarIds.length} selected
        </div>
      </div>
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {calendars.map((calendar) => {
          const active = selectedCalendarIds.includes(calendar.id)
          return (
            <label
              key={calendar.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: active ? '1px solid var(--crm-accent)' : '1px solid var(--crm-border-soft)',
                borderRadius: 10,
                padding: '8px 10px',
                cursor: 'pointer',
                background: active ? 'var(--crm-bg-soft)' : 'var(--crm-card)',
              }}
            >
              <input type="checkbox" checked={active} onChange={() => toggleCalendar(calendar.id)} />
              <span
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: calendar.backgroundColor ?? '#9ca3af',
                  border: '1px solid rgba(0,0,0,0.1)',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--crm-text)' }}>
                {calendar.summary ?? calendar.id}
                {calendar.primary ? ' (Primary)' : ''}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

type MonthBoardProps = {
  calendarById: Map<string, CalendarInfo>
  events: CalendarEvent[]
  eventsError: string | null
  eventsLoading: boolean
  goToNextMonth: () => void
  goToPreviousMonth: () => void
  goToToday: () => void
  monthWeekRows: MonthWeekRow[]
  onSelectDay: (dayKey: string) => void
  selectedCalendarIds: string[]
  selectedDayKey: string
  today: Date
  visibleMonth: Date
}

export function MonthBoard({
  calendarById,
  events,
  eventsError,
  eventsLoading,
  goToNextMonth,
  goToPreviousMonth,
  goToToday,
  monthWeekRows,
  onSelectDay,
  selectedCalendarIds,
  selectedDayKey,
  today,
  visibleMonth,
}: MonthBoardProps) {
  return (
    <main className="month-panel">
      <div className="month-toolbar">
        <div className="month-title-block">
          <div className="month-title">{monthTitle(visibleMonth)}</div>
          <div className="month-subtitle">
            {eventsLoading ? 'Loading events...' : `${events.length} event${events.length === 1 ? '' : 's'} loaded`}
          </div>
        </div>
        <div className="month-actions">
          <button type="button" onClick={goToPreviousMonth} style={pillButton}>
            Prev
          </button>
          <button type="button" onClick={goToToday} style={pillButton}>
            Today
          </button>
          <button type="button" onClick={goToNextMonth} style={pillButton}>
            Next
          </button>
        </div>
      </div>

      {selectedCalendarIds.length === 0 ? (
        <div style={emptyState}>Choose calendars above to show your month board.</div>
      ) : eventsError ? (
        <div
          style={{
            border: '1px solid var(--crm-danger-border)',
            background: 'var(--crm-danger-bg)',
            color: 'var(--crm-danger-text)',
            borderRadius: 12,
            padding: 12,
            fontSize: 13,
          }}
        >
          {eventsError}
        </div>
      ) : (
        <div className="month-board" aria-busy={eventsLoading}>
          <div className="month-weekday-row">
            {weekDays.map((weekday) => (
              <div key={weekday} className="weekday-label">
                {weekday}
              </div>
            ))}
          </div>

          {monthWeekRows.map(({ rowCount, segments, week, weekKey, weekMinHeight }) => {
            return (
              <div
                key={weekKey}
                className="month-week"
                style={{ minHeight: weekMinHeight }}
              >
                {week.map((day) => {
                  const dayKey = localDateKey(day)
                  const selected = selectedDayKey === dayKey
                  const isToday = sameLocalDay(day, today)
                  const inMonth = day.getMonth() === visibleMonth.getMonth()

                  return (
                    <button
                      key={dayKey}
                      type="button"
                      className="day-cell"
                      onClick={() => onSelectDay(dayKey)}
                      data-selected={selected ? 'true' : 'false'}
                      data-muted={inMonth ? 'false' : 'true'}
                    >
                      <span className={isToday ? 'day-number today-number' : 'day-number'}>
                        {dayNumberLabel(day, visibleMonth)}
                      </span>
                    </button>
                  )
                })}

                <div className="event-layer" style={{ gridTemplateRows: `repeat(${rowCount}, 20px)` }}>
                  {segments.map((segment) => {
                    const calendar = calendarById.get(segment.event.calendarId)
                    const color = calendar?.backgroundColor ?? '#0ea5e9'

                    return (
                      <EventSegment
                        key={`${segment.event.calendarId}:${segment.event.id}:${segment.event.start ?? ''}:${segment.row}`}
                        calendarName={calendar?.summary ?? segment.event.calendarId}
                        color={color}
                        onSelectDay={() => onSelectDay(localDateKey(week[segment.startIndex]))}
                        segment={segment}
                        textColor={getContrastText(color)}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}

type SelectedDayPanelProps = {
  calendarById: Map<string, CalendarInfo>
  selectedDay: Date
  selectedDayEvents: CalendarEvent[]
}

export function SelectedDayPanel({
  calendarById,
  selectedDay,
  selectedDayEvents,
}: SelectedDayPanelProps) {
  return (
    <section className="selected-day-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--crm-text)' }}>
            {selectedDay.toLocaleDateString([], { weekday: 'long' })}
          </div>
          <div style={{ marginTop: 3, fontSize: 12, color: 'var(--crm-muted)', fontWeight: 700 }}>
            {selectedDay.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--crm-muted)', fontWeight: 800 }}>
          {selectedDayEvents.length} item{selectedDayEvents.length === 1 ? '' : 's'}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {selectedDayEvents.length === 0 ? (
          <div style={emptyState}>No calendar items for this day.</div>
        ) : (
          selectedDayEvents.map((event) => {
            const calendar = calendarById.get(event.calendarId)
            return (
              <div key={`${event.calendarId}:${event.id}:${event.start ?? ''}`} className="detail-event">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: calendar?.backgroundColor ?? '#0ea5e9',
                        border: '1px solid rgba(0,0,0,0.1)',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ fontSize: 13, fontWeight: 850, color: 'var(--crm-text)', minWidth: 0 }}>
                      {event.summary ?? '(No title)'}
                    </div>
                  </div>
                  {event.htmlLink ? (
                    <a
                      href={event.htmlLink}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12, color: 'var(--crm-text)', fontWeight: 800, textDecoration: 'underline' }}
                    >
                      Open
                    </a>
                  ) : null}
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--crm-muted-strong)', fontWeight: 700 }}>
                  {formatEventTime(event.start, event.end)}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--crm-muted)' }}>
                  {calendar?.summary ?? event.calendarId}
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

const pillButton: CSSProperties = {
  height: 32,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid var(--crm-border)',
  background: 'var(--crm-card)',
  color: 'var(--crm-text)',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
}

const emptyState: CSSProperties = {
  border: '1px dashed #d1d5db',
  borderRadius: 12,
  padding: 12,
  color: 'var(--crm-muted)',
  fontSize: 13,
  background: 'var(--crm-bg-soft)',
}

'use client'

import type { CSSProperties } from 'react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmDenseActionRow } from '@/app/crm/_components/CrmDenseActionRow'
import { CrmDenseMetaList } from '@/app/crm/_components/CrmDenseMetaList'
import { CrmDenseSectionHeader } from '@/app/crm/_components/CrmDenseSectionHeader'
import { CrmDenseSurfaceCard } from '@/app/crm/_components/CrmDenseSurfaceCard'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'

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
    <div className="grid gap-3">
      <CrmDenseSectionHeader
        title="Calendars"
        badge={
          <span className="ace-crm-chip border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-surface-muted)] text-[color:var(--crm-ui-muted)]">
            {selectedCalendarIds.length} selected
          </span>
        }
      />
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {calendars.map((calendar) => {
          const active = selectedCalendarIds.includes(calendar.id)
          return (
            <label
              key={calendar.id}
              className={`flex cursor-pointer items-center gap-2 rounded-[16px] border px-3 py-2 ${
                active
                  ? 'border-[color:var(--crm-ui-accent-border)] bg-[color:var(--crm-ui-accent-soft)]'
                  : 'border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-surface)]'
              }`}
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
        <CrmDenseActionRow className="month-actions">
          <CrmButton type="button" onClick={goToPreviousMonth} className="min-h-0 px-3 py-1.5 text-xs">
            Prev
          </CrmButton>
          <CrmButton type="button" onClick={goToToday} className="min-h-0 px-3 py-1.5 text-xs">
            Today
          </CrmButton>
          <CrmButton type="button" onClick={goToNextMonth} className="min-h-0 px-3 py-1.5 text-xs">
            Next
          </CrmButton>
        </CrmDenseActionRow>
      </div>

      {selectedCalendarIds.length === 0 ? (
        <CrmEmptyState
          compact
          emoji="📆"
          title="Choose calendars"
          description="Choose calendars above to show your month board."
          className="m-4 shadow-none"
        />
      ) : eventsError ? (
        <CrmNotice tone="error" compact>
          {eventsError}
        </CrmNotice>
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
      <CrmDenseSectionHeader
        title={selectedDay.toLocaleDateString([], { weekday: 'long' })}
        description={selectedDay.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
        badge={
          <span className="ace-crm-chip border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-surface-muted)] text-[color:var(--crm-ui-muted)]">
            {selectedDayEvents.length} item{selectedDayEvents.length === 1 ? '' : 's'}
          </span>
        }
      />

      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {selectedDayEvents.length === 0 ? (
          <CrmEmptyState
            compact
            emoji="🗓️"
            title="No calendar items"
            description="No calendar items for this day."
            className="shadow-none"
          />
        ) : (
          selectedDayEvents.map((event) => {
            const calendar = calendarById.get(event.calendarId)
            return (
              <CrmDenseSurfaceCard
                key={`${event.calendarId}:${event.id}:${event.start ?? ''}`}
                className="detail-event shadow-none"
                tone="muted"
              >
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
                <CrmDenseMetaList
                  className="mt-3"
                  items={[
                    { label: 'Time', value: formatEventTime(event.start, event.end) },
                    { label: 'Calendar', value: calendar?.summary ?? event.calendarId },
                  ]}
                />
              </CrmDenseSurfaceCard>
            )
          })
        )}
      </div>
    </section>
  )
}

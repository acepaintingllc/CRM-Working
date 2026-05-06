'use client'

import type { LucideIcon } from 'lucide-react'
import { CalendarCheck, CalendarClock, Mail, Trash2 } from 'lucide-react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmResourceState } from '@/app/crm/_components/CrmResourceState'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { crmInputClassName } from '@/app/crm/_components/crmStyles'
import StageEmailModal, { stageEmailActionLabel } from '@/app/crm/jobs/_components/StageEmailModal'
import { useJobSchedulePage } from './_hooks/useJobSchedulePage'

const iconSizeSm = 16

function iconLabel(Icon: LucideIcon, label: string, size = iconSizeSm) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={size} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

export function JobSchedulePageContent() {
  const controller = useJobSchedulePage()

  return (
    <CrmPageShell className="max-w-[900px]">
      <CrmPageHeader
        eyebrow="Pipeline workflow"
        title="Schedule job"
        description="Add one or more scheduled date ranges for this job."
        backHref={controller.backHref}
        backLabel="Back to job"
      />

      <CrmSectionCard title="Schedule blocks">
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <CrmField label="Start">
              <input
                type="datetime-local"
                value={controller.form.startLocal}
                onChange={(event) => controller.actions.setStartLocal(event.target.value)}
                className={crmInputClassName('text-sm')}
              />
            </CrmField>
            <CrmField label="End">
              <input
                type="datetime-local"
                value={controller.form.endLocal}
                onChange={(event) => controller.actions.setEndLocal(event.target.value)}
                className={crmInputClassName('text-sm')}
              />
            </CrmField>
          </div>

          <CrmField label="Notes (optional)">
            <textarea
              value={controller.form.notes}
              onChange={(event) => controller.actions.setNotes(event.target.value)}
              placeholder="Crew, materials, access notes, etc."
              className={crmInputClassName('min-h-[90px] resize-y text-sm')}
            />
          </CrmField>

          {controller.error ? (
            <CrmNotice tone="error" compact>
              {controller.error}
            </CrmNotice>
          ) : null}
          {controller.notice ? (
            <CrmNotice tone="success" compact>
              {controller.notice}
            </CrmNotice>
          ) : null}

          <CrmButton
            type="button"
            onClick={() => void controller.actions.addSchedule()}
            disabled={controller.saving}
            tone="primary"
          >
            {controller.saving
              ? iconLabel(CalendarClock, 'Saving...')
              : iconLabel(CalendarClock, 'Add scheduled block')}
          </CrmButton>
        </div>
      </CrmSectionCard>

      <div className="mt-3.5">
        <CrmResourceState
          loading={controller.loading}
          error={controller.error}
          hasData={!controller.loading}
          loadingTitle="Loading schedule"
          loadingDescription="Loading scheduled blocks..."
          errorTitle="Schedule unavailable"
          onRetry={() => void controller.actions.refresh()}
        >
          {!controller.hasSchedules ? (
            <CrmEmptyState
              title="No schedule blocks yet"
              description="Add the first scheduled block to begin job scheduling and calendar sync."
            />
          ) : (
            <>
              <div className="grid gap-2">
                {controller.rows.map((row) => (
                  <div
                    key={row.id}
                    className="ace-crm-surface flex justify-between gap-3 rounded-[var(--crm-ui-radius-sm)] p-3"
                  >
                    <div>
                      <div className="font-extrabold text-[color:var(--crm-ui-text)]">
                        {row.rangeLabel}
                      </div>
                      {row.notes ? (
                        <div className="mt-1 text-[13px] text-[color:var(--crm-ui-muted)]">
                          {row.notes}
                        </div>
                      ) : null}
                      {row.calendarStatusLabel ? (
                        <div className="mt-1 text-xs font-bold text-green-600">
                          {row.calendarStatusLabel}
                        </div>
                      ) : null}
                    </div>
                    <CrmButton onClick={() => void controller.actions.deleteSchedule(row.id)} tone="danger">
                      {iconLabel(Trash2, 'Delete')}
                    </CrmButton>
                  </div>
                ))}
              </div>

              <div className="mt-2.5">
                <div className="flex flex-wrap gap-2">
                  <CrmButton
                    type="button"
                    onClick={() => void controller.actions.addToCalendar()}
                    disabled={controller.addingCalendar}
                    tone="primary"
                  >
                    {controller.addingCalendar
                      ? iconLabel(CalendarCheck, 'Adding to calendar...')
                      : iconLabel(CalendarCheck, 'Add scheduled blocks to Google Calendar')}
                  </CrmButton>
                  <CrmButton
                    type="button"
                    onClick={controller.actions.openScheduledEmail}
                    tone={controller.jobMeta?.scheduled_email_sent_at ? 'secondary' : 'primary'}
                  >
                    {iconLabel(
                      Mail,
                      stageEmailActionLabel(
                        'scheduled',
                        Boolean(controller.jobMeta?.scheduled_email_sent_at)
                      )
                    )}
                  </CrmButton>
                </div>
              </div>
            </>
          )}
        </CrmResourceState>
      </div>

      <StageEmailModal
        jobId={controller.email.jobId}
        stage={controller.email.stage}
        open={controller.email.open}
        onClose={controller.actions.closeStageEmail}
        onSent={controller.actions.handleStageEmailSent}
      />
    </CrmPageShell>
  )
}

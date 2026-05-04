'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmDenseActionRow } from '@/app/crm/_components/CrmDenseActionRow'
import type { JobWorkflowResolvedAction } from '@/lib/jobs/types'
import {
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Mail,
  NotebookTabs,
  Send,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

function iconLabel(Icon: LucideIcon, label: string, size = 16) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={size} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

type JobActionRailProps = {
  actions: JobWorkflowResolvedAction[]
  getActionTone: (action: JobWorkflowResolvedAction) => 'primary' | 'secondary' | 'danger'
  onAction: (action: JobWorkflowResolvedAction) => void
}

function actionIcon(action: JobWorkflowResolvedAction): LucideIcon {
  switch (action.id) {
    case 'send_quote_scheduled':
    case 'send_follow_up':
    case 'send_scheduled_email':
    case 'open_closeout':
    case 'move_to_follow_up':
      return Mail
    case 'edit_send_quote':
    case 'mark_quote_sent':
      return Send
    case 'open_quote':
      return FileText
    case 'open_job_actuals':
      return ClipboardCheck
    case 'open_estimate_review':
      return NotebookTabs
    case 'schedule_job':
    case 'change_scheduled_date':
      return CalendarCheck
    case 'mark_completed':
      return CheckCircle2
    case 'mark_lost':
      return XCircle
    default:
      return Mail
  }
}

export default function JobActionRail({ actions, getActionTone, onAction }: JobActionRailProps) {
  return (
    <div className="mt-2 grid gap-3">
      <CrmDenseActionRow>
        {actions.map((action) => {
          const Icon = actionIcon(action)
          if (action.kind === 'message') {
            return (
              <div key={action.id} className="grid gap-1">
                <CrmButton
                  type="button"
                  tone={getActionTone(action)}
                  className="min-h-0 px-2.5 py-1.5 text-xs opacity-70"
                  disabled
                  aria-describedby={`${action.id}-reason`}
                >
                  {iconLabel(Icon, action.label)}
                </CrmButton>
                {action.disabledReason ? (
                  <p
                    id={`${action.id}-reason`}
                    className="max-w-56 text-[11px] leading-snug text-[color:var(--crm-ui-muted)]"
                  >
                    {action.disabledReason}
                  </p>
                ) : null}
              </div>
            )
          }
          if (action.kind === 'navigate' && action.href) {
            return (
              <CrmButton
                key={action.id}
                href={action.href}
                tone={getActionTone(action)}
                className="min-h-0 px-2.5 py-1.5 text-xs no-underline"
              >
                {iconLabel(Icon, action.label)}
              </CrmButton>
            )
          }

          return (
            <CrmButton
              type="button"
              key={action.id}
              onClick={() => onAction(action)}
              tone={getActionTone(action)}
              className="min-h-0 px-2.5 py-1.5 text-xs"
            >
              {iconLabel(Icon, action.label)}
            </CrmButton>
          )
        })}
      </CrmDenseActionRow>
    </div>
  )
}

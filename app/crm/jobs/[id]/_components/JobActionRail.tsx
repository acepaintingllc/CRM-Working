'use client'

import type { JobWorkflowResolvedAction } from '@/lib/jobs/types'
import Link from 'next/link'
import {
  CalendarCheck,
  Camera,
  CheckCircle2,
  FileText,
  Mail,
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
  getActionClassName: (action: JobWorkflowResolvedAction) => string
  onAction: (action: JobWorkflowResolvedAction) => void
}

function actionIcon(action: JobWorkflowResolvedAction): LucideIcon {
  switch (action.id) {
    case 'open_field_camera':
      return Camera
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

export default function JobActionRail({
  actions,
  getActionClassName,
  onAction,
}: JobActionRailProps) {
  return (
    <div className="mt-5 grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => {
          const Icon = actionIcon(action)
          if (action.kind === 'navigate' && action.href) {
            return (
              <Link
                key={action.id}
                href={action.href}
                className={`${getActionClassName(action)} no-underline`}
              >
                {iconLabel(Icon, action.label)}
              </Link>
            )
          }

          return (
            <button
              type="button"
              key={action.id}
              onClick={() => onAction(action)}
              className={getActionClassName(action)}
            >
              {iconLabel(Icon, action.label)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

import Link from 'next/link'
import { CalendarCheck, NotebookText } from 'lucide-react'
import { crmBorderStyle, crmButtonSecondaryStyle } from './primitives/tokens'

type SignalsFooterActionsProps = {
  actions: Array<{
    href: string
    label: string
    icon: 'calendar' | 'notes'
  }>
}

function actionIcon(icon: 'calendar' | 'notes') {
  return icon === 'calendar'
    ? <CalendarCheck size={13} aria-hidden="true" />
    : <NotebookText size={13} aria-hidden="true" />
}

export function SignalsFooterActions({ actions }: SignalsFooterActionsProps) {
  return (
    <div className="flex gap-2 border-t px-5 py-3" style={crmBorderStyle}>
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition"
          style={crmButtonSecondaryStyle}
        >
          {actionIcon(action.icon)}
          {action.label}
        </Link>
      ))}
    </div>
  )
}

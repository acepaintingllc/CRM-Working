import { CalendarCheck, NotebookText } from 'lucide-react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmDenseActionRow } from '@/app/crm/_components/CrmDenseActionRow'
import { crmBorderStyle } from './primitives/tokens'

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
    <CrmDenseActionRow className="hidden border-t px-5 py-3 md:flex" style={crmBorderStyle}>
      {actions.map((action) => (
        <CrmButton
          key={action.href}
          href={action.href}
          className="min-h-0 px-3 py-1.5 text-xs no-underline"
        >
          {actionIcon(action.icon)}
          {action.label}
        </CrmButton>
      ))}
    </CrmDenseActionRow>
  )
}

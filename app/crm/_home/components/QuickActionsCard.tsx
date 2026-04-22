import { CalendarCheck, Plus, Users, Wrench } from 'lucide-react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmDenseActionRow } from '@/app/crm/_components/CrmDenseActionRow'
import { CrmDenseSurfaceCard } from '@/app/crm/_components/CrmDenseSurfaceCard'

type QuickActionsCardProps = {
  viewModel: {
    items: Array<{
      href: string
      label: string
      icon: 'calendar' | 'plus' | 'users' | 'wrench'
      tone: 'primary' | 'secondary'
    }>
  }
}

function actionIcon(icon: 'calendar' | 'plus' | 'users' | 'wrench') {
  if (icon === 'calendar') return <CalendarCheck size={13} aria-hidden="true" />
  if (icon === 'wrench') return <Wrench size={13} aria-hidden="true" />
  if (icon === 'plus') return <Plus size={13} aria-hidden="true" />
  return <Users size={13} aria-hidden="true" />
}

export function QuickActionsCard({ viewModel }: QuickActionsCardProps) {
  return (
    <CrmDenseSurfaceCard
      title="Quick actions"
      actions={
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--crm-ui-muted)]">
          <Plus size={14} aria-hidden="true" />
          Shared CRM actions
        </span>
      }
    >
      <CrmDenseActionRow className="grid grid-cols-2 sm:flex sm:flex-wrap">
        {viewModel.items.map((item) => (
          <CrmButton
            key={item.href}
            href={item.href}
            tone={item.tone}
            className="justify-center text-sm no-underline sm:justify-start"
          >
            {actionIcon(item.icon)}
            {item.label}
          </CrmButton>
        ))}
      </CrmDenseActionRow>
    </CrmDenseSurfaceCard>
  )
}
